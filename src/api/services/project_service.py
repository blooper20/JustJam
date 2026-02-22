"""
프로젝트 관리 서비스 레이어
"""

import hashlib
import json
import logging
import math
import os
import shutil
import tempfile
import uuid
from datetime import datetime
from typing import Dict, List, Optional

import librosa
import numpy as np
import soundfile as sf
from pydub import AudioSegment
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session, joinedload

from src.api.database import SessionLocal
from src.api.exceptions import (
    AudioProcessingError,
    FileUploadError,
    ProjectNotFoundError,
    TranscriptionError,
)
from src.api.models import ProjectAsset, ProjectMember, ProjectModel, User
from src.api.schemas.project import ProjectUpdate, TaskStatus, MixRequest
from src.audio_processor import separate_audio
from src.score_generator import create_score
from src.tab_generator import TabGenerator
from src.transcriber import transcribe_audio

logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "temp", "uploads")
SEPARATED_DIR = os.path.join(PROJECT_ROOT, "temp", "separated")


def generate_thumbnail(audio_path: str, output_path: str):
    """오디오 파일을 기반으로 스펙트로그램 썸네일 생성"""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import librosa.display

        y, sr = librosa.load(audio_path, duration=30, sr=22050)
        S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
        S_dB = librosa.power_to_db(S, ref=np.max)

        plt.figure(figsize=(4, 2))
        librosa.display.specshow(S_dB, sr=sr, x_axis=None, y_axis=None, cmap="magma")
        plt.axis("off")
        plt.tight_layout(pad=0)

        plt.savefig(output_path, dpi=100, bbox_inches="tight", pad_inches=0, transparent=True)
        plt.close()
        return True
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return False


from src.api.celery_app import celery_app


def process_audio_logic(project_id: str, celery_self=None):
    """음원 분리 작업의 핵심 로직 (Celery와 BackgroundTasks 공통)"""
    db = SessionLocal()
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            return

        project.status = TaskStatus.PROCESSING.value
        db.commit()

        input_path = os.path.join(UPLOAD_DIR, project.original_filename)

        def update_progress(percent: int):
            scaled_req = min(int(percent * 0.95), 99)
            try:
                # DB 업데이트
                project.progress = scaled_req
                db.commit()
                # Celery State 업데이트 (Celery 환경에서만)
                if celery_self:
                    celery_self.update_state(state="PROGRESS", meta={"percent": scaled_req})
            except Exception as e:
                logger.error(f"Error updating progress: {e}")
                db.rollback()

        try:
            stems = separate_audio(
                input_path, model_name="htdemucs_6s", progress_callback=update_progress
            )
            
            # BPM 감지
            try:
                stem_dir = os.path.join(SEPARATED_DIR, "htdemucs_6s", project_id)
                drums_path = os.path.join(stem_dir, "drums.wav")
                target_path = drums_path if os.path.exists(drums_path) else input_path

                y, sr = librosa.load(target_path, sr=None, duration=60)
                tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
                detected_bpm = (
                    int(round(tempo)) if isinstance(tempo, float) else int(round(tempo[0]))
                )

                project.bpm = detected_bpm
                logger.info(f"Detected BPM: {detected_bpm}")
            except Exception as e:
                logger.error(f"BPM Detection failed: {e}")

            # 마스터 웨이브폼 생성
            try:
                stem_dir = os.path.join(SEPARATED_DIR, "htdemucs_6s", project_id)
                master = None
                for stem in ["vocals", "drums", "bass", "guitar", "piano", "other"]:
                    stem_path = os.path.join(stem_dir, f"{stem}.wav")
                    if os.path.exists(stem_path):
                        audio = AudioSegment.from_wav(stem_path)
                        if master is None:
                            master = audio
                        else:
                            master = master.overlay(audio)

                if master:
                    master.export(os.path.join(stem_dir, "master.wav"), format="wav")
                    logger.info(f"Generated master.wav for {project_id}")
            except Exception as e:
                logger.error(f"Master mix generation failed: {e}")

            # 키/코드/구조 분석
            try:
                from src.api.services.analysis_service import perform_full_analysis
                analysis_results = perform_full_analysis(input_path, float(project.bpm or 120.0))
                project.detected_key = analysis_results.get("key")
                project.chord_progression = json.dumps(analysis_results.get("chords"))
                project.structure = json.dumps(analysis_results.get("structure"))
            except Exception as e:
                logger.error(f"Analysis failed for {project_id}: {e}")

            if stems and "original" not in stems:
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


@celery_app.task(bind=True, name="process_audio_task")
def process_audio_task(self, project_id: str):
    """음원 분리 백그라운드 작업 (Celery Task Wrapper)"""
    return process_audio_logic(project_id, celery_self=self)



class ProjectService:
    @staticmethod
    def create_project(db: Session, file_name: str, file_content, current_user: Optional[User] = None):
        """프로젝트 생성"""
        project_id = str(uuid.uuid4())
        file_ext = os.path.splitext(file_name)[1]
        saved_filename = f"{project_id}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, saved_filename)

        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file_content, buffer)
        except Exception as e:
            raise FileUploadError(detail=f"파일 업로드 실패: {str(e)}")

        project = ProjectModel(
            id=project_id,
            name=file_name,
            original_filename=saved_filename,
            status=TaskStatus.PENDING.value,
            progress=0,
            user_id=current_user.id if current_user else None,
            created_at=datetime.utcnow(),
        )

        db.add(project)
        db.commit()
        db.refresh(project)

        return project, file_path

    @staticmethod
    def get_project(db: Session, project_id: str, current_user: Optional[User] = None):
        """프로젝트 조회 및 권한 확인"""
        project = (
            db.query(ProjectModel)
            .options(joinedload(ProjectModel.assets), joinedload(ProjectModel.members).joinedload(ProjectMember.user))
            .filter(ProjectModel.id == project_id)
            .first()
        )
        if not project:
            raise ProjectNotFoundError()

        is_owner = current_user and project.user_id == current_user.id
        is_member = False
        if current_user and not is_owner:
            member = (
                db.query(ProjectMember)
                .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id)
                .first()
            )
            is_member = member is not None

        if project.user_id is not None:
            from src.api.exceptions import AuthenticationError
            if not is_owner and not is_member:
                raise AuthenticationError(detail="이 프로젝트에 접근할 권한이 없습니다.")

        # 자산 보유 여부 설정
        project.has_score = any(a.asset_type == "score" for a in project.assets)
        project.has_tab = any(a.asset_type == "tab" for a in project.assets)
        project.score_instruments = [a.instrument for a in project.assets if a.asset_type == "score"]
        project.tab_instruments = [a.instrument for a in project.assets if a.asset_type == "tab"]
        project.is_owner = bool(current_user and project.user_id == current_user.id)

        for m in project.members:
            m.email = m.user.email
            m.nickname = m.user.nickname

        return project

    @staticmethod
    def list_projects(db: Session, current_user: Optional[User] = None, q: str = None, sort: str = "newest", skip: int = 0, limit: int = 50):
        """프로젝트 목록 조회"""
        query = db.query(ProjectModel).options(joinedload(ProjectModel.assets))

        if current_user:
            shared_project_ids = db.query(ProjectMember.project_id).filter(ProjectMember.user_id == current_user.id).all()
            shared_project_ids = [p[0] for p in shared_project_ids]
            query = query.filter(or_(ProjectModel.user_id == current_user.id, ProjectModel.id.in_(shared_project_ids)))
        else:
            query = query.filter(ProjectModel.user_id == None)

        if q:
            query = query.filter(ProjectModel.name.ilike(f"%{q}%"))

        if sort == "newest":
            query = query.order_by(desc(ProjectModel.created_at))
        elif sort == "oldest":
            query = query.order_by(ProjectModel.created_at.asc())
        elif sort == "name":
            query = query.order_by(ProjectModel.name.asc())

        projects = query.offset(skip).limit(limit).all()

        for p in projects:
            p.has_score = any(a.asset_type == "score" for a in p.assets)
            p.has_tab = any(a.asset_type == "tab" for a in p.assets)
            p.score_instruments = [a.instrument for a in p.assets if a.asset_type == "score"]
            p.tab_instruments = [a.instrument for a in p.assets if a.asset_type == "tab"]
            p.is_owner = bool(current_user and p.user_id == current_user.id)

        return projects

    @staticmethod
    def update_project(db: Session, project_id: str, name: str, current_user: Optional[User] = None):
        """프로젝트 정보 수정"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        if project.user_id is not None:
            if not current_user or project.user_id != current_user.id:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="프로젝트 수정 권한이 없습니다.")

        if name is not None:
            project.name = name

        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def delete_project(db: Session, project_id: str, current_user: Optional[User] = None):
        """프로젝트 삭제"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        if project.user_id is not None:
            if not current_user or project.user_id != current_user.id:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="이 프로젝트를 삭제할 권한이 없습니다")

        db.delete(project)
        db.commit()
        return {"message": "Project deleted successfully"}

    @staticmethod
    def clone_project(db: Session, project_id: str, current_user: Optional[User] = None):
        """프로젝트 복제"""
        source_project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not source_project:
            raise ProjectNotFoundError()

        if source_project.user_id is not None:
            if not current_user or source_project.user_id != current_user.id:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="프로젝트 복제 권한이 없습니다.")

        new_project_id = str(uuid.uuid4())
        source_ext = os.path.splitext(source_project.original_filename)[1]
        new_filename = f"{new_project_id}{source_ext}"

        source_path = os.path.join(UPLOAD_DIR, source_project.original_filename)
        new_path = os.path.join(UPLOAD_DIR, new_filename)

        try:
            if os.path.exists(source_path):
                shutil.copy2(source_path, new_path)
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=f"파일 복제 중 오류 발생: {str(e)}")

        new_project = ProjectModel(
            id=new_project_id,
            name=f"{source_project.name} (Copy)",
            original_filename=new_filename,
            status=TaskStatus.PENDING.value,
            progress=0,
            bpm=source_project.bpm,
            user_id=current_user.id if current_user else None,
            created_at=datetime.utcnow(),
        )

        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        return new_project

    @staticmethod
    def get_project_stems(db: Session, project_id: str, current_user: Optional[User] = None):
        """스템 파일 목록 조회"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        if project.user_id is not None:
            if not current_user or project.user_id != current_user.id:
                from src.api.exceptions import AuthenticationError
                raise AuthenticationError(detail="이 프로젝트에 접근할 권한이 없습니다.")

        if project.status != TaskStatus.COMPLETED.value:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="아직 처리가 완료되지 않았습니다.")

        base_url = f"/static/separated/htdemucs_6s/{project_id}"
        from src.api.schemas.project import StemFiles
        return StemFiles(
            vocals=f"{base_url}/vocals.wav",
            bass=f"{base_url}/bass.wav",
            drums=f"{base_url}/drums.wav",
            guitar=f"{base_url}/guitar.wav",
            piano=f"{base_url}/piano.wav",
            other=f"{base_url}/other.wav",
            master=f"{base_url}/master.wav",
        )

    @staticmethod
    def generate_score(db: Session, project_id: str, instrument: str, current_user: Optional[User] = None):
        """악보 생성"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        if project.user_id is not None:
            if not current_user or project.user_id != current_user.id:
                from src.api.exceptions import AuthenticationError
                raise AuthenticationError(detail="이 프로젝트에 접근할 권한이 없습니다.")

        if project.status != TaskStatus.COMPLETED.value:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="먼저 음원 분리가 완료되어야 합니다.")

        existing_asset = db.query(ProjectAsset).filter(
            ProjectAsset.project_id == project_id,
            ProjectAsset.asset_type == "score",
            ProjectAsset.instrument == instrument,
        ).first()

        if existing_asset:
            return existing_asset.content, True

        input_path = os.path.join(UPLOAD_DIR, project.original_filename)
        target_stem = instrument.lower()

        try:
            notes, bpm = transcribe_audio(input_path, target_stem=target_stem)
            xml_content = create_score(notes, bpm, instrument)

            new_asset = ProjectAsset(
                project_id=project_id, asset_type="score", instrument=instrument, content=xml_content
            )
            db.add(new_asset)
            db.commit()

            return xml_content, False
        except Exception as e:
            logger.exception(f"Score generation failed: {e}")
            raise TranscriptionError(detail=f"악보 생성 실패: {str(e)}")

    @staticmethod
    def generate_midi(db: Session, project_id: str, instrument: str, current_user: Optional[User] = None):
        """MIDI 생성"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        is_owner = current_user and project.user_id == current_user.id
        is_member = False
        if current_user and not is_owner:
            member = db.query(ProjectMember).filter(
                ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id
            ).first()
            is_member = member is not None

        if project.user_id is not None:
            if not is_owner and not is_member:
                from src.api.exceptions import AuthenticationError
                raise AuthenticationError(detail="이 프로젝트에 접근할 권한이 없습니다.")

        if project.status != TaskStatus.COMPLETED.value:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="먼저 음원 분리가 완료되어야 합니다.")

        existing_asset = db.query(ProjectAsset).filter(
            ProjectAsset.project_id == project_id,
            ProjectAsset.asset_type == "midi",
            ProjectAsset.instrument == instrument,
        ).first()

        import base64
        if existing_asset:
            return base64.b64decode(existing_asset.content), True

        input_path = os.path.join(UPLOAD_DIR, project.original_filename)
        target_stem = instrument.lower()

        try:
            notes, bpm = transcribe_audio(input_path, target_stem=target_stem)
            midi_bytes = create_score(notes, bpm, instrument, format="midi")

            new_asset = ProjectAsset(
                project_id=project_id,
                asset_type="midi",
                instrument=instrument,
                content=base64.b64encode(midi_bytes).decode("utf-8"),
            )
            db.add(new_asset)
            db.commit()

            return midi_bytes, False
        except Exception as e:
            logger.exception(f"MIDI generation failed: {e}")
            raise TranscriptionError(detail=f"MIDI 생성 실패: {str(e)}")

    @staticmethod
    def generate_tab(db: Session, project_id: str, instrument: str, current_user: Optional[User] = None):
        """타브 악보 생성"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        if project.user_id is not None:
            if not current_user or project.user_id != current_user.id:
                from src.api.exceptions import AuthenticationError
                raise AuthenticationError(detail="이 프로젝트에 접근할 권한이 없습니다.")

        if project.status != TaskStatus.COMPLETED.value:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="먼저 음원 분리가 완료되어야 합니다.")

        existing_asset = db.query(ProjectAsset).filter(
            ProjectAsset.project_id == project_id,
            ProjectAsset.asset_type == "tab",
            ProjectAsset.instrument == instrument,
        ).first()

        if existing_asset:
            return json.loads(existing_asset.content), True

        input_path = os.path.join(UPLOAD_DIR, project.original_filename)

        if instrument == "bass":
            tuning = ["E1", "A1", "D2", "G2"]
            target_stem = "bass"
        elif instrument == "guitar":
            tuning = ["E2", "A2", "D3", "G3", "B3", "E4"]
            target_stem = "guitar"
        else:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="지원하지 않는 악기입니다.")

        try:
            from src.tab_generator import TabGenerator
            notes, bpm = transcribe_audio(input_path, target_stem=target_stem)
            generator = TabGenerator(tuning=tuning, bpm=bpm)
            ascii_tab = generator.generate_ascii_tab(notes)

            result = {
                "project_id": project_id,
                "instrument": instrument,
                "bpm": bpm,
                "tab": ascii_tab,
                "notes_count": len(notes),
            }

            new_asset = ProjectAsset(
                project_id=project_id,
                asset_type="tab",
                instrument=instrument,
                content=json.dumps(result),
            )
            db.add(new_asset)
            db.commit()

            return result, False
        except Exception as e:
            logger.exception(f"Tab generation failed: {e}")
            raise TranscriptionError(detail=f"타브 생성 실패: {str(e)}")

    @staticmethod
    def mix_audio(db: Session, project_id: str, request, current_user: Optional[User] = None):
        """오디오 믹싱 (퀄리티 향상 버전)"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        if project.user_id is not None:
            if not current_user or project.user_id != current_user.id:
                from src.api.exceptions import AuthenticationError
                raise AuthenticationError(detail="이 프로젝트에 접근할 권한이 없습니다.")

        if project.status != TaskStatus.COMPLETED.value:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="음원 분리가 완료되지 않았습니다.")

        stem_dir = os.path.join(SEPARATED_DIR, "htdemucs_6s", project_id)
        mixed = None

        try:
            for stem_name, volume in request.volumes.items():
                if volume < 0.01:
                    continue
                stem_path = os.path.join(stem_dir, f"{stem_name}.wav")
                if not os.path.exists(stem_path):
                    continue

                audio = AudioSegment.from_wav(stem_path)
                if volume >= 1.0:
                    db_change = 0
                else:
                    db_change = 20 * math.log10(volume)
                audio = audio + db_change

                if mixed is None:
                    mixed = audio
                else:
                    mixed = mixed.overlay(audio)

            # 메트로놈 추가 (librosa.clicks 사용)
            if request.metronome > 0.01 and mixed is not None:
                duration_sec = mixed.duration_seconds
                sr = 44100
                tempo = request.bpm
                if tempo > 300: tempo = 120

                beat_times = np.arange(request.start_offset, duration_sec, 60.0 / tempo)
                downbeats = beat_times[::4]
                mask = np.ones(len(beat_times), dtype=bool)
                mask[::4] = False
                offbeats = beat_times[mask]

                clicks_strong = librosa.clicks(times=downbeats, sr=sr, length=int(duration_sec * sr), click_freq=1500, click_duration=0.1)
                clicks_weak = librosa.clicks(times=offbeats, sr=sr, length=int(duration_sec * sr), click_freq=800, click_duration=0.1)
                clicks = clicks_strong + (clicks_weak * 0.5)

                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_click:
                    sf.write(tmp_click.name, clicks, sr)
                    click_path = tmp_click.name

                click_audio = AudioSegment.from_wav(click_path)
                db_c = 0 if request.metronome >= 1.0 else 20 * math.log10(request.metronome)
                click_audio = click_audio + db_c
                mixed = mixed.overlay(click_audio)
                os.unlink(click_path)

            if mixed is None:
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="믹싱할 오디오 데이터가 없습니다.")

            # 캐싱을 위한 해시
            mix_params = json.dumps(request.dict(), sort_keys=True)
            mix_hash = hashlib.md5(mix_params.encode()).hexdigest()
            output_filename = f"mix_{project_id}_{mix_hash}.mp3"
            output_path = os.path.join(UPLOAD_DIR, output_filename)

            if not os.path.exists(output_path):
                mixed.export(output_path, format="mp3")
            
            return f"/static/uploads/{output_filename}"
        except Exception as e:
            logger.exception(f"Mixing failed: {e}")
            raise AudioProcessingError(detail=f"믹싱 실패: {str(e)}")

    @staticmethod
    def share_project(db: Session, project_id: str, email: str, role: str, current_user: User):
        """프로젝트 공유 초대"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        if project.user_id != current_user.id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="프로젝트 공유 권한이 없습니다.")

        target_user = db.query(User).filter(User.email == email).first()
        if not target_user:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

        existing_member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id, ProjectMember.user_id == target_user.id
        ).first()

        if existing_member:
            existing_member.role = role
        else:
            new_member = ProjectMember(project_id=project_id, user_id=target_user.id, role=role)
            db.add(new_member)

        db.commit()
        return {"message": f"Project shared with {email}"}

    @staticmethod
    def list_members(db: Session, project_id: str, current_user: User):
        """멤버 목록 조회"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        # 권한 확인 생략 (프로젝트 접근 가능하면 멤버 목록 볼 수 있음)
        members = db.query(ProjectMember).options(joinedload(ProjectMember.user)).filter(ProjectMember.project_id == project_id).all()
        
        result = []
        for m in members:
            result.append({
                "user_id": m.user_id,
                "email": m.user.email,
                "nickname": m.user.nickname,
                "role": m.role,
                "joined_at": m.joined_at
            })
        return result

    @staticmethod
    def remove_member(db: Session, project_id: str, user_id: int, current_user: User):
        """멤버 삭제"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        # 권한 확인: 소유자이거나 본인 탈퇴
        if project.user_id != current_user.id and user_id != current_user.id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="권한이 없습니다.")

        member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        ).first()

        if not member:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="멤버를 찾을 수 없습니다.")

        db.delete(member)
        db.commit()
        return {"message": "Member removed successfully"}
