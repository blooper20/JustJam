from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
import shutil
import os
import uuid
from datetime import datetime
import logging
import math
import numpy as np
import librosa
from pydub import AudioSegment
import soundfile as sf
import tempfile
import json
from pydantic import BaseModel
from typing import Dict, List, Optional

from src.api.schemas.project import Project, TaskStatus, StemFiles
from src.api.database import get_db, SessionLocal
from src.api.models import Project as ProjectModel, ProjectAsset, User
from src.api.exceptions import ProjectNotFoundError, AudioProcessingError, TranscriptionError
from src.api.dependencies import get_current_user, get_optional_current_user
from src.audio_processor import separate_audio
from src.transcriber import transcribe_audio
from src.tab_generator import TabGenerator
from src.score_generator import create_score

router = APIRouter()
logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "temp", "uploads")
SEPARATED_DIR = os.path.join(PROJECT_ROOT, "temp", "separated")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_audio_task(project_id: str):
    """Background task for Demucs audio separation using SQLite"""
    db = SessionLocal()
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            return

        project.status = TaskStatus.PROCESSING.value
        db.commit()

        input_path = os.path.join(UPLOAD_DIR, project.original_filename)

        def update_progress(percent: int):
             # Scale to 95% so users don't see 100% while post-processing
             scaled_req = min(int(percent * 0.95), 99)
             try:
                 project.progress = scaled_req
                 db.commit()
             except Exception as e:
                 logger.error(f"Error updating progress: {e}")
                 db.rollback()

        try:
            stems = separate_audio(input_path, model_name='htdemucs_6s', progress_callback=update_progress)
            
            # Detect BPM
            try:
                # Use drums for better BPM detection if available
                # separate_audio usually returns dict, keys are stem names, values are paths or tensors?
                # separate_audio saves files to disk. Let's assume standard demucs output structure.
                stem_dir = os.path.join(SEPARATED_DIR, "htdemucs_6s", project_id)
                drums_path = os.path.join(stem_dir, "drums.wav")
                target_path = drums_path if os.path.exists(drums_path) else input_path
                 
                y, sr = librosa.load(target_path, sr=None, duration=60) # Analyze first 60s
                tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
                # librosa > 0.10 returns float if scalar, else array
                detected_bpm = int(round(tempo)) if isinstance(tempo, float) else int(round(tempo[0]))
                 
                project.bpm = detected_bpm
                logger.info(f"Detected BPM: {detected_bpm}")
            except Exception as e:
                logger.error(f"BPM Detection failed: {e}")

            # Generate Master Mix for Waveform Visualization
            try:
                stem_dir = os.path.join(SEPARATED_DIR, "htdemucs_6s", project_id)
                master = None
                for stem in ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']:
                    stem_path = os.path.join(stem_dir, f"{stem}.wav")
                    if os.path.exists(stem_path):
                        audio = AudioSegment.from_wav(stem_path)
                        if master is None: master = audio
                        else: master = master.overlay(audio)
                
                if master:
                    master.export(os.path.join(stem_dir, "master.wav"), format="wav")
                    logger.info(f"Generated master.wav for {project_id}")
            except Exception as e:
                logger.error(f"Master mix generation failed: {e}")

            if stems and 'original' not in stems:
                project.status = TaskStatus.COMPLETED.value
                project.progress = 100
            else:
                project.status = TaskStatus.FAILED.value
            
            db.commit()

        except Exception as e:
            logger.exception(f"{project_id} processing failed: {e}")
            project.status = TaskStatus.FAILED.value
            db.commit()
    finally:
        db.close()

@router.post(
    "/", 
    response_model=Project,
    summary="새 프로젝트 생성",
    description="음원을 업로드하여 새로운 프로젝트를 생성합니다. 음원 분리는 자동으로 시작되지 않으며 /process 엔드포인트를 호출해야 합니다.",
    responses={
        201: {"description": "프로젝트 생성 성공"},
        400: {"description": "지원하지 않는 파일 형식"},
        413: {"description": "파일 크기 초과"}
    }
)
async def create_project(
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """프로젝트 생성 (인증 선택적)"""
    project_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    saved_filename = f"{project_id}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
        
    project = ProjectModel(
        id=project_id,
        name=file.filename,
        original_filename=saved_filename,
        status=TaskStatus.PENDING.value,
        progress=0,
        user_id=current_user.id if current_user else None,  # 사용자 ID 할당
        created_at=datetime.utcnow()
    )
    
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.post(
    "/{project_id}/process", 
    response_model=Project,
    summary="음원 분리 시작",
    description="프로젝트의 음원을 각 트랙(보컬, 드럼, 베이스 등)으로 분리하는 백그라운드 작업을 시작합니다.",
    responses={
        202: {"description": "작업 시작됨"},
        404: {"description": "프로젝트를 찾을 수 없음"}
    }
)
async def process_project(
    project_id: str, 
    background_tasks: BackgroundTasks, 
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ProjectNotFoundError()

    if project.user_id is not None:
        if not current_user or project.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        
    if project.status == TaskStatus.PROCESSING.value:
         raise HTTPException(status_code=400, detail="Already processing")

    background_tasks.add_task(process_audio_task, project_id)
    project.status = TaskStatus.PENDING.value
    db.commit()
    db.refresh(project)
    return project

@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: str, 
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(ProjectModel).options(joinedload(ProjectModel.assets)).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ProjectNotFoundError()
        
    if project.user_id is not None:
        if not current_user or project.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")

    # 자산 보유 여부 설정
    project.has_score = any(a.asset_type == 'score' for a in project.assets)
    project.has_tab = any(a.asset_type == 'tab' for a in project.assets)
    project.score_instruments = [a.instrument for a in project.assets if a.asset_type == 'score']
    project.tab_instruments = [a.instrument for a in project.assets if a.asset_type == 'tab']
    
    return project

@router.get("/", response_model=List[Project])
async def list_projects(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """프로젝트 목록 조회 (로그인한 사용자는 본인 프로젝트만, 비로그인은 모든 프로젝트)"""
    if current_user:
        # 로그인한 사용자: 본인의 프로젝트만 반환
        projects = db.query(ProjectModel).options(joinedload(ProjectModel.assets)).filter(ProjectModel.user_id == current_user.id).all()
    else:
        # 비로그인 사용자: 모든 프로젝트 반환
        projects = db.query(ProjectModel).options(joinedload(ProjectModel.assets)).filter(ProjectModel.user_id == None).all()
    
    # 자산 보유 여부 일괄 설정
    for p in projects:
        p.has_score = any(a.asset_type == 'score' for a in p.assets)
        p.has_tab = any(a.asset_type == 'tab' for a in p.assets)
        p.score_instruments = [a.instrument for a in p.assets if a.asset_type == 'score']
        p.tab_instruments = [a.instrument for a in p.assets if a.asset_type == 'tab']
        
    return projects

@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """프로젝트 삭제 (소유자만 가능)"""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ProjectNotFoundError()
    
    # 권한 확인: 프로젝트 소유자이거나 user_id가 None인 경우만 삭제 가능
    if project.user_id is not None:
        if not current_user or project.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="이 프로젝트를 삭제할 권한이 없습니다"
            )
    
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}

@router.get("/{project_id}/stems", response_model=StemFiles)
async def get_project_stems(
    project_id: str, 
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
         raise ProjectNotFoundError()
    
    if project.user_id is not None:
        if not current_user or project.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    if project.status != TaskStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Processing not completed")

    base_url = f"/static/separated/htdemucs_6s/{project_id}"
    return StemFiles(
        vocals=f"{base_url}/vocals.wav",
        bass=f"{base_url}/bass.wav",
        drums=f"{base_url}/drums.wav",
        guitar=f"{base_url}/guitar.wav",
        piano=f"{base_url}/piano.wav",
        other=f"{base_url}/other.wav",
        master=f"{base_url}/master.wav"
    )

@router.post(
    "/{project_id}/score/{instrument}",
    summary="악보 생성",
    description="특정 악기 트랙을 AI로 분석하여 MusicXML 형식의 악보를 생성합니다.",
    responses={
        200: {"description": "악보 생성 성공 (XML 반환)"},
        404: {"description": "프로젝트 또는 트랙을 찾을 수 없음"},
        500: {"description": "분석 오류 (Transcription Error)"}
    }
)
def generate_project_score(
    project_id: str, 
    instrument: str, 
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ProjectNotFoundError()

    if project.user_id is not None:
        if not current_user or project.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    if project.status != TaskStatus.COMPLETED.value:
         raise HTTPException(status_code=400, detail="Audio separation required first")
         
    # DB에서 이미 생성된 악보가 있는지 확인
    existing_asset = db.query(ProjectAsset).filter(
        ProjectAsset.project_id == project_id,
        ProjectAsset.asset_type == 'score',
        ProjectAsset.instrument == instrument
    ).first()
    
    if existing_asset:
        logger.info(f"Returning cached score for {project_id} ({instrument})")
        return Response(
            content=existing_asset.content, 
            media_type="application/xml",
            headers={"X-Cache": "HIT"}
        )

    input_path = os.path.join(UPLOAD_DIR, project.original_filename)
    target_stem = instrument.lower()
    
    try:
        notes, bpm = transcribe_audio(input_path, target_stem=target_stem)
        xml_content = create_score(notes, bpm, instrument)
        
        # 생성된 악보 DB에 저장
        new_asset = ProjectAsset(
            project_id=project_id,
            asset_type='score',
            instrument=instrument,
            content=xml_content
        )
        db.add(new_asset)
        db.commit()
        
        return Response(content=xml_content, media_type="application/xml")
    except Exception as e:
        logger.exception(f"Score generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Score generation failed: {str(e)}")

@router.post(
    "/{project_id}/tabs/{instrument}",
    summary="타브 악보 생성",
    description="특정 악기 트랙을 AI로 분석하여 ASCII 형식의 타브 악보를 생성합니다.",
    responses={
        200: {"description": "타브 생성 성공"},
        404: {"description": "프로젝트 또는 트랙을 찾을 수 없음"}
    }
)
def generate_project_tab(
    project_id: str, 
    instrument: str, 
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ProjectNotFoundError()

    if project.user_id is not None:
        if not current_user or project.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    if project.status != TaskStatus.COMPLETED.value:
         raise HTTPException(status_code=400, detail="Audio separation required first")
         
    # DB에서 이미 생성된 타브가 있는지 확인
    existing_asset = db.query(ProjectAsset).filter(
        ProjectAsset.project_id == project_id,
        ProjectAsset.asset_type == 'tab',
        ProjectAsset.instrument == instrument
    ).first()
    
    if existing_asset:
        logger.info(f"Returning cached tab for {project_id} ({instrument})")
        return JSONResponse(
            content=json.loads(existing_asset.content),
            headers={"X-Cache": "HIT"}
        )

    input_path = os.path.join(UPLOAD_DIR, project.original_filename)
    
    tuning = None
    target_stem = None
    
    if instrument == 'bass':
        tuning = ['E1', 'A1', 'D2', 'G2']
        target_stem = 'bass'
    elif instrument == 'guitar':
        tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
        target_stem = 'guitar'
    else:
        raise HTTPException(status_code=400, detail="Unsupported instrument")

    try:
        notes, bpm = transcribe_audio(input_path, target_stem=target_stem)
        generator = TabGenerator(tuning=tuning, bpm=bpm)
        ascii_tab = generator.generate_ascii_tab(notes)
        
        result = {
            "project_id": project_id,
            "instrument": instrument,
            "bpm": bpm,
            "tab": ascii_tab,
            "notes_count": len(notes)
        }
        
        # 생성된 타브 DB에 저장
        new_asset = ProjectAsset(
            project_id=project_id,
            asset_type='tab',
            instrument=instrument,
            content=json.dumps(result)
        )
        db.add(new_asset)
        db.commit()
        
        return result
    except Exception as e:
        logger.exception(f"Tab generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Tab generation failed: {str(e)}")

class MixRequest(BaseModel):
    volumes: Dict[str, float]
    bpm: float = 120.0
    metronome: float = 0.0
    start_offset: float = 0.0

@router.post("/{project_id}/mix")
def mix_audio(
    project_id: str, 
    request: MixRequest, 
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ProjectNotFoundError()

    if project.user_id is not None:
        if not current_user or project.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    if project.status != TaskStatus.COMPLETED.value:
         raise HTTPException(status_code=400, detail="Audio separation not completed")

    stem_dir = os.path.join(SEPARATED_DIR, "htdemucs_6s", project_id)
    mixed = None
    
    try:
        for stem_name, volume in request.volumes.items():
             if volume < 0.01: continue
             stem_path = os.path.join(stem_dir, f"{stem_name}.wav")
             if not os.path.exists(stem_path): continue
             
             audio = AudioSegment.from_wav(stem_path)
             if volume >= 1.0: db_change = 0
             else: db_change = 20 * math.log10(volume)
             audio = audio + db_change
             
             if mixed is None: mixed = audio
             else: mixed = mixed.overlay(audio)
        
        # Add Metronome if requested
        if request.metronome > 0.01 and mixed is not None:
             try:
                 # Check if we have volume for metronome
                 # Generate click track
                 duration_sec = mixed.duration_seconds
                 sr = 44100
                 
                 # Create Metronome Click with librosa
                 # 1. Beat locations
                 # Generate strong and weak clicks for 4/4 time signature
                 tempo = request.bpm
                 if tempo > 300: tempo = 120 # Sanity check
                 
                 # Beats
                 beat_times = np.arange(request.start_offset, duration_sec, 60.0 / tempo)
                 
                 # Separate downbeats (assumed 4/4) and offbeats
                 # Downbeats at indices 0, 4, 8...
                 downbeats = beat_times[::4]
                 # Offbeats are the rest
                 mask = np.ones(len(beat_times), dtype=bool)
                 mask[::4] = False
                 offbeats = beat_times[mask]
                 
                 # Generate clicks
                 # Strong click: 1200Hz, Weak click: 800Hz
                 clicks_strong = librosa.clicks(times=downbeats, sr=sr, length=int(duration_sec * sr), click_freq=1500, click_duration=0.1)
                 clicks_weak = librosa.clicks(times=offbeats, sr=sr, length=int(duration_sec * sr), click_freq=800, click_duration=0.1)
                 
                 # Combine: clicks_strong typically has higher amplitude? 
                 # librosa.clicks returns amplitude 1 signals.
                 # Let's make strong louder.
                 clicks = clicks_strong + (clicks_weak * 0.5)
                 
                 # Create temp wav for clicks
                 with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_click:
                     sf.write(tmp_click.name, clicks, sr)
                     click_path = tmp_click.name
                 
                 click_audio = AudioSegment.from_wav(click_path)
                 
                 # Adjust volume
                 # request.metronome is 0-1
                 if request.metronome >= 1.0: db_c = 0
                 else: db_c = 20 * math.log10(request.metronome)
                 
                 click_audio = click_audio + db_c
                 
                 # Loop or trim
                 # librosa.clicks returns exact length? 
                 # overlay handles length mismatch (aligns at 0)
                 mixed = mixed.overlay(click_audio)
                 
                 os.unlink(click_path)
                 
             except Exception as e:
                 logger.error(f"Failed to add metronome: {e}")
                 # Continue without metronome rather than failing entirely

        if mixed is None:
             raise HTTPException(status_code=400, detail="No audio to mix")

        output_filename = f"mix_{project_id}_{int(datetime.utcnow().timestamp())}.mp3"
        output_path = os.path.join(UPLOAD_DIR, output_filename)
        mixed.export(output_path, format="mp3")
        
        return {"url": f"/static/uploads/{output_filename}"}
    except Exception as e:
        logger.exception(f"Mixing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Mixing failed: {str(e)}")
