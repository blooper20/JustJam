from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
import shutil
import os
import uuid
from datetime import datetime
import logging

from src.api.schemas.project import Project, TaskStatus, StemFiles
from src.api.services.store import projects_db
from src.audio_processor import separate_audio # 기존 로직 사용

router = APIRouter()
logger = logging.getLogger(__name__)

# 경로 설정
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "temp", "uploads")
SEPARATED_DIR = os.path.join(PROJECT_ROOT, "temp", "separated")

os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=Project)
async def create_project(file: UploadFile = File(...)):
    """
    오디오 파일을 업로드하여 새로운 프로젝트를 생성합니다.
    """
    project_id = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1]
    saved_filename = f"{project_id}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 업로드 실패: {str(e)}")
        
    project = Project(
        id=project_id,
        name=file.filename,
        original_filename=saved_filename,
        status=TaskStatus.PENDING,
        created_at=datetime.utcnow()
    )
    
    projects_db[project_id] = project
    return project

def process_audio_task(project_id: str):
    """Demucs 음원 분리를 수행하는 백그라운드 작업"""
    if project_id not in projects_db:
        return

    project = projects_db[project_id]
    project.status = TaskStatus.PROCESSING
    
    input_path = os.path.join(UPLOAD_DIR, project.original_filename)
    
    try:
        def update_progress(percent: int):
            if project_id in projects_db:
                projects_db[project_id].progress = percent
                
        # 기존 분리 로직 사용: 진행률 콜백 추가
        stems = separate_audio(input_path, model_name='htdemucs_6s', progress_callback=update_progress)
        
        # 성공 여부 확인
        if stems and 'original' not in stems:
             project.status = TaskStatus.COMPLETED
             # stems는 절대 경로를 반환함. API 서빙을 위해 상대 경로 등으로 변환 필요할 수 있음
        else:
             project.status = TaskStatus.FAILED
             
    except Exception as e:
        logger.exception(f"{project_id} 처리 실패: {e}")
        project.status = TaskStatus.FAILED

@router.post("/{project_id}/process", response_model=Project)
async def process_project(project_id: str, background_tasks: BackgroundTasks):
    """
    음원 분리 작업을 트리거합니다.
    """
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
        
    project = projects_db[project_id]
    
    if project.status == TaskStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="이미 처리 중입니다")
        
    background_tasks.add_task(process_audio_task, project_id)
    project.status = TaskStatus.PENDING # 기술적으로는 대기열에 추가됨
    
    return project

@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
    return projects_db[project_id]

@router.get("/{project_id}/stems", response_model=StemFiles)
async def get_project_stems(project_id: str):
    """
    분리된 스템 파일들의 다운로드 URL을 반환합니다.
    """
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
    
    project = projects_db[project_id]
    
    if project.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="처리가 완료되지 않았습니다")
        
    # 정적 파일 경로 구성 (/static -> temp 폴더)
    # 예상 경로: /static/separated/htdemucs_6s/{project_id}/{stem}.wav
    base_url = f"/static/separated/htdemucs_6s/{project_id}"
    
    # 실제 파일 존재 여부를 확인하는 것이 좋지만, 일단 URL 구조 기반으로 반환
    return StemFiles(
        vocals=f"{base_url}/vocals.wav",
        bass=f"{base_url}/bass.wav",
        drums=f"{base_url}/drums.wav",
        guitar=f"{base_url}/guitar.wav",
        piano=f"{base_url}/piano.wav",
        other=f"{base_url}/other.wav"
    )

@router.get("/", response_model=list[Project])
async def list_projects():
    return list(projects_db.values())

@router.delete("/{project_id}")
async def delete_project(project_id: str):
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
    
    project = projects_db.pop(project_id)
    
    # Optional: Delete files from disk as well
    # UPLOAD_DIR / project.original_filename
    # SEPARATED_DIR / ...
    
    return {"message": "Project deleted successfully"}

from src.transcriber import transcribe_audio
from src.tab_generator import TabGenerator
from src.score_generator import create_score
from fastapi import Response

@router.post("/{project_id}/score/{instrument}")
def generate_project_score(project_id: str, instrument: str):
    """
    Generate MusicXML score for a specific instrument.
    Instruments: vocals, bass, drums, guitar, piano, other
    """
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
    
    project = projects_db[project_id]
    if project.status != TaskStatus.COMPLETED:
         raise HTTPException(status_code=400, detail="먼저 음원 분리(분석)가 완료되어야 합니다.")
         
    input_path = os.path.join(UPLOAD_DIR, project.original_filename)
    
    # Map instrument to target stem
    # 'drums' is special - we might need special handling in transcriber later, 
    # but for now we pass 'drums' and see what basic-pitch does (it will produce notes, which score generator will render)
    target_stem = instrument.lower()
    
    try:
        # Transcribe
        notes, bpm = transcribe_audio(input_path, target_stem=target_stem)
        
        # Generate MusicXML
        xml_content = create_score(notes, bpm, instrument)
        
        # Return as XML file
        return Response(content=xml_content, media_type="application/xml")
        
    except Exception as e:
        logger.exception(f"Score generation failed for {project_id}/{instrument}: {e}")
        raise HTTPException(status_code=500, detail=f"악보 생성 실패: {str(e)}")

@router.post("/{project_id}/tabs/{instrument}")
def generate_project_tab(project_id: str, instrument: str):
    """
    Generate tablature for a specific instrument.
    instrument: 'guitar' or 'bass'
    """
    if project_id not in projects_db:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다")
    
    project = projects_db[project_id]
    if project.status != TaskStatus.COMPLETED:
         raise HTTPException(status_code=400, detail="먼저 음원 분리(분석)가 완료되어야 합니다.")
         
    input_path = os.path.join(UPLOAD_DIR, project.original_filename)
    
    # Tuning & Stem Selection
    tuning = None
    target_stem = None
    
    if instrument == 'bass':
        tuning = ['E1', 'A1', 'D2', 'G2']
        target_stem = 'bass'
    elif instrument == 'guitar':
        tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
        target_stem = 'guitar' # transcriber handles fallback to 'other' if needed
    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 악기입니다. (guitar, bass)")

    try:
        # Transcribe (Blocking call, run in threadpool by FastAPI since this func is not async)
        notes, bpm = transcribe_audio(input_path, target_stem=target_stem)
        
        # Generate Tab
        generator = TabGenerator(tuning=tuning, bpm=bpm)
        ascii_tab = generator.generate_ascii_tab(notes)
        
        return {
            "project_id": project_id,
            "instrument": instrument,
            "bpm": bpm,
            "tab": ascii_tab,
            "notes_count": len(notes)
        }
    except Exception as e:
        logger.exception(f"Tab generation failed for {project_id}/{instrument}: {e}")
        raise HTTPException(status_code=500, detail=f"타브 생성 실패: {str(e)}")
