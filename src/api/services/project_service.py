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
from typing import Optional

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
)
from src.api.models import ProjectMember, ProjectModel, User
from src.api.schemas.project import TaskStatus
from src.audio_processor import separate_audio

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
        import librosa.display
        import matplotlib.pyplot as plt

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

        def update_progress(percent: int, status_text: Optional[str] = None):
            scaled_req = min(int(percent * 0.95), 99)
            try:
                # DB 업데이트
                project.progress = scaled_req
                if status_text:
                    project.status_text = status_text
                db.commit()
                # Celery State 업데이트 (Celery 환경에서만)
                if celery_self:
                    meta = {"percent": scaled_req}
                    if status_text:
                        meta["status_text"] = status_text
                    celery_self.update_state(state="PROGRESS", meta=meta)
            except Exception as e:
                logger.error(f"Error updating progress: {e}")
                db.rollback()

        try:
            update_progress(0, "오디오 청크 분할 및 분리 중...")
            stems = separate_audio(
                input_path, model_name="htdemucs_6s", progress_callback=update_progress
            )

            # BPM 감지
            try:
                update_progress(100, "BPM 분석 중...")
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
                update_progress(100, "마스터 믹스 생성 중...")
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
                update_progress(100, "악보 데이터 추출 중...")
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
    def create_project(
        db: Session,
        file_name: str,
        file_content,
        current_user: Optional[User] = None,
        team_id: Optional[int] = None,
    ):
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
            team_id=team_id,
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
            .options(
                joinedload(ProjectModel.members).joinedload(ProjectMember.user),
            )
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
                .filter(
                    ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id
                )
                .first()
            )
            is_member = member is not None

        if project.user_id is not None:
            from src.api.exceptions import AuthenticationError

            if not is_owner and not is_member:
                raise AuthenticationError(detail="이 프로젝트에 접근할 권한이 없습니다.")

        project.is_owner = bool(current_user and project.user_id == current_user.id)

        for m in project.members:
            m.email = m.user.email
            m.nickname = m.user.nickname

        return project

    @staticmethod
    def list_projects(
        db: Session,
        current_user: Optional[User] = None,
        q: str = None,
        sort: str = "newest",
        skip: int = 0,
        limit: int = 50,
        team_id: Optional[int] = None,
    ):
        """프로젝트 목록 조회"""
        query = db.query(ProjectModel)

        if team_id is not None:
            query = query.filter(ProjectModel.team_id == team_id)
        elif current_user:
            shared_project_ids = (
                db.query(ProjectMember.project_id)
                .filter(ProjectMember.user_id == current_user.id)
                .all()
            )
            shared_project_ids = [p[0] for p in shared_project_ids]
            query = query.filter(
                or_(
                    ProjectModel.user_id == current_user.id, ProjectModel.id.in_(shared_project_ids)
                )
            )
        else:
            query = query.filter(ProjectModel.user_id.is_(None))

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
            p.is_owner = bool(current_user and p.user_id == current_user.id)

        return projects

    @staticmethod
    def check_manager_permission(db: Session, project: ProjectModel, user: User) -> bool:
        """프로젝트의 매니저 혹은 부매니저인지 여부 확인"""
        if not user:
            return False
        # 1. 프로젝트 소유자인 경우
        if project.user_id == user.id:
            return True
        # 2. 팀 소유자 혹은 팀 매니저/부매니저인 경우
        if project.team_id:
            from src.api.models import Team, TeamMember

            team = db.query(Team).filter(Team.id == project.team_id).first()
            if team and team.owner_id == user.id:
                return True

            member = (
                db.query(TeamMember)
                .filter(TeamMember.team_id == project.team_id, TeamMember.user_id == user.id)
                .first()
            )
            if member and member.role in ["owner", "editor"]:
                return True
        return False

    @staticmethod
    def update_project(
        db: Session,
        project_id: str,
        name: Optional[str] = None,
        practice_deadline: Optional[str] = None,
        current_user: Optional[User] = None,
    ):
        """프로젝트 정보 수정"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        if name is not None:
            if not current_user or project.user_id != current_user.id:
                from fastapi import HTTPException

                raise HTTPException(status_code=403, detail="프로젝트 이름 수정 권한이 없습니다.")
            project.name = name

        if practice_deadline is not None:
            if not current_user or not ProjectService.check_manager_permission(
                db, project, current_user
            ):
                from fastapi import HTTPException

                raise HTTPException(
                    status_code=403,
                    detail="프로젝트 마감일 설정 권한이 없습니다 (매니저/부매니저만 가능).",
                )

            # 마감일 업데이트 (만약 빈 문자열이면 None 처리)
            deadline_val = practice_deadline if practice_deadline.strip() else None
            project.practice_deadline = deadline_val

            # 새 마감일이 오늘 날짜보다 미래이거나 같으면 비디오 병합 초기화
            if deadline_val:
                from datetime import datetime, timedelta

                today_str = (datetime.utcnow() + timedelta(hours=9)).strftime("%Y-%m-%d")
                if deadline_val >= today_str:
                    project.merged_vlog_status = "none"
                    project.merged_vlog_url = None

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
                if tempo > 300:
                    tempo = 120

                beat_times = np.arange(request.start_offset, duration_sec, 60.0 / tempo)
                downbeats = beat_times[::4]
                mask = np.ones(len(beat_times), dtype=bool)
                mask[::4] = False
                offbeats = beat_times[mask]

                clicks_strong = librosa.clicks(
                    times=downbeats,
                    sr=sr,
                    length=int(duration_sec * sr),
                    click_freq=1500,
                    click_duration=0.1,
                )
                clicks_weak = librosa.clicks(
                    times=offbeats,
                    sr=sr,
                    length=int(duration_sec * sr),
                    click_freq=800,
                    click_duration=0.1,
                )
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

        existing_member = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == target_user.id)
            .first()
        )

        if existing_member:
            existing_member.role = role
            member = existing_member
        else:
            new_member = ProjectMember(project_id=project_id, user_id=target_user.id, role=role)
            db.add(new_member)
            member = new_member

        db.commit()
        db.refresh(member)

        # Helper fields for schema
        member.email = target_user.email
        member.nickname = target_user.nickname
        return member

    @staticmethod
    def list_members(db: Session, project_id: str, current_user: User):
        """멤버 목록 조회"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        # 권한 확인 생략 (프로젝트 접근 가능하면 멤버 목록 볼 수 있음)
        members = (
            db.query(ProjectMember)
            .options(joinedload(ProjectMember.user))
            .filter(ProjectMember.project_id == project_id)
            .all()
        )

        result = []
        for m in members:
            result.append(
                {
                    "user_id": m.user_id,
                    "email": m.user.email,
                    "nickname": m.user.nickname,
                    "role": m.role,
                    "instrument": m.instrument,
                    "joined_at": m.joined_at,
                }
            )
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

        member = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
            .first()
        )

        if not member:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="멤버를 찾을 수 없습니다.")

        db.delete(member)
        db.commit()
        return {"message": "Member removed successfully"}

    @staticmethod
    def update_member_instrument(
        db: Session, project_id: str, user_id: int, instrument: str, current_user: User
    ):
        """멤버 악기(역할) 업데이트"""
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise ProjectNotFoundError()

        # 권한 확인: 프로젝트 소유자만 변경 가능
        if project.user_id != current_user.id:
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="권한이 없습니다.")

        member = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
            .first()
        )

        if not member:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="멤버를 찾을 수 없습니다.")

        member.instrument = instrument
        db.commit()
        db.refresh(member)
        return member


def create_placeholder_card(instrument: str, output_path: str):
    """연습 영상 미제출자를 위한 카드 이미지 생성 (Pillow)"""
    import os
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (640, 360), color="#0d0e12")
    draw = ImageDraw.Draw(img)

    instrument_map = {
        "vocal": ("VOCAL", "🎤"),
        "guitar": ("GUITAR", "🎸"),
        "bass": ("BASS", "🔊"),
        "drum": ("DRUMS", "🥁"),
        "keyboard": ("KEYBOARD", "🎹"),
        "piano": ("PIANO", "🎹"),
        "other": ("OTHER", "🎵"),
    }

    label, emoji = instrument_map.get(
        instrument.lower() if instrument else "other", ("OTHER", "🎵")
    )

    font_path = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
    if not os.path.exists(font_path):
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

    if not os.path.exists(font_path):
        font = ImageFont.load_default()
        large_font = font
    else:
        try:
            font = ImageFont.truetype(font_path, 28)
            large_font = ImageFont.truetype(font_path, 72)
        except Exception:
            font = ImageFont.load_default()
            large_font = font

    draw.rounded_rectangle([30, 30, 610, 330], radius=15, outline="#27272a", width=3)

    try:
        emoji_w = draw.textlength(emoji, font=large_font)
        draw.text(((640 - emoji_w) / 2, 80), emoji, font=large_font, fill="#ffffff")
    except Exception:
        draw.text((280, 80), emoji, font=large_font, fill="#ffffff")

    try:
        label_w = draw.textlength(label, font=font)
        draw.text(((640 - label_w) / 2, 190), label, font=font, fill="#f472b6")
    except Exception:
        draw.text((250, 190), label, font=font, fill="#f472b6")

    try:
        msg = "연습 영상 미제출"
        msg_w = draw.textlength(msg, font=font)
        draw.text(((640 - msg_w) / 2, 240), msg, font=font, fill="#71717a")
    except Exception:
        draw.text((220, 240), msg, font=font, fill="#71717a")

    img.save(output_path)


def create_daily_vstack_video(video_paths: list, output_path: str):
    """비디오들을 640x(960/N) 크기로 맞춘 후 vstack 및 amix 믹싱"""
    import subprocess

    N = len(video_paths)
    target_width = 640
    individual_height = int(960 / N)

    cmd = ["ffmpeg", "-y"]
    for p in video_paths:
        cmd.extend(["-i", p])

    if N == 1:
        cmd.extend(
            [
                "-filter_complex",
                f"[0:v]scale={target_width}:{individual_height}:"
                "force_original_aspect_ratio=decrease,"
                f"pad={target_width}:{individual_height}:(ow-iw)/2:(oh-ih)/2[outv]",
                "-map",
                "[outv]",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-c:a",
                "aac",
                "-pix_fmt",
                "yuv420p",
                output_path,
            ]
        )
    else:
        filter_complex = ""
        for i in range(N):
            filter_complex += (
                f"[{i}:v]scale={target_width}:{individual_height}:"
                "force_original_aspect_ratio=decrease,"
                f"pad={target_width}:{individual_height}:(ow-iw)/2:(oh-ih)/2[v{i}];"
            )

        inputs_v = "".join([f"[v{i}]" for i in range(N)])
        filter_complex += f"{inputs_v}vstack=inputs={N}[outv];"

        inputs_a = "".join([f"[{i}:a]" for i in range(N)])
        filter_complex += f"{inputs_a}amix=inputs={N}:duration=first[outa]"

        cmd.extend(
            [
                "-filter_complex",
                filter_complex,
                "-map",
                "[outv]",
                "-map",
                "[outa]",
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-c:a",
                "aac",
                "-pix_fmt",
                "yuv420p",
                output_path,
            ]
        )

    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def concat_videos(video_paths: list, output_path: str):
    """비디오들을 시간 순서대로 concat"""
    import os
    import subprocess
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        for p in video_paths:
            f.write(f"file '{p}'\n")
        txt_path = f.name

    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", txt_path, "-c", "copy", output_path]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    finally:
        if os.path.exists(txt_path):
            os.remove(txt_path)


def merge_practice_videos_logic(project_id: str):
    """연습 비디오 병합 메인 로직"""
    import os
    import tempfile
    from src.api.database import SessionLocal
    from src.api.logging_config import logger
    from src.api.models import PracticeLog, ProjectModel, TeamMember

    db = SessionLocal()
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            logger.error(f"Project {project_id} not found for merging")
            return

        project.merged_vlog_status = "processing"
        db.commit()

        # 1. 고정된 멤버 리스트 구성
        members_data = []

        owner = project.owner
        if owner:
            owner_inst = "vocal"
            if project.team_id:
                tm = (
                    db.query(TeamMember)
                    .filter(TeamMember.team_id == project.team_id, TeamMember.user_id == owner.id)
                    .first()
                )
                if tm and tm.instrument:
                    owner_inst = tm.instrument
            members_data.append({"user_id": owner.id, "instrument": owner_inst})

        for pm in project.members:
            if any(m["user_id"] == pm.user_id for m in members_data):
                continue
            members_data.append({"user_id": pm.user_id, "instrument": pm.instrument or "vocal"})

        members_data.sort(key=lambda x: x["user_id"])

        if not members_data:
            logger.warning(f"No members found for project {project_id}")
            project.merged_vlog_status = "failed"
            db.commit()
            return

        # 2. PracticeLog 조회 및 일자별 그룹화
        logs = db.query(PracticeLog).filter(PracticeLog.project_id == project_id).all()
        if not logs:
            logger.warning(f"No practice logs found for project {project_id}")
            project.merged_vlog_status = "none"
            db.commit()
            return

        from collections import defaultdict

        daily_logs = defaultdict(list)
        for log in logs:
            daily_logs[log.logged_date].append(log)

        sorted_dates = sorted(daily_logs.keys())

        PROJECT_ROOT = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        vlog_dir = os.path.join(PROJECT_ROOT, "temp", "uploads", "vlogs")
        os.makedirs(vlog_dir, exist_ok=True)

        temp_files_to_clean = []
        daily_video_paths = []

        # 3. 일자별 영상 생성
        for date_str in sorted_dates:
            day_logs = daily_logs[date_str]
            user_to_log = {}
            for log in day_logs:
                rel_path = log.video_url.replace("/static/", "")
                abs_path = os.path.join(PROJECT_ROOT, "temp", rel_path)
                if os.path.exists(abs_path):
                    if (
                        log.user_id not in user_to_log
                        or log.created_at > user_to_log[log.user_id].created_at
                    ):
                        user_to_log[log.user_id] = log

            if not user_to_log:
                continue

            day_member_videos = []

            for m in members_data:
                uid = m["user_id"]
                inst = m["instrument"]

                if uid in user_to_log:
                    log = user_to_log[uid]
                    rel_path = log.video_url.replace("/static/", "")
                    abs_path = os.path.join(PROJECT_ROOT, "temp", rel_path)
                    day_member_videos.append(abs_path)
                else:
                    temp_vid = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
                    temp_files_to_clean.append(temp_vid)

                    try:
                        placeholder_dir = os.path.join(
                            PROJECT_ROOT, "temp", "uploads", "vlogs", "placeholders"
                        )
                        os.makedirs(placeholder_dir, exist_ok=True)
                        cached_vid = os.path.join(placeholder_dir, f"{inst.lower()}.mp4")

                        if not os.path.exists(cached_vid):
                            temp_img = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
                            try:
                                create_placeholder_card(inst, temp_img)
                                import subprocess

                                cmd = [
                                    "ffmpeg",
                                    "-y",
                                    "-loop",
                                    "1",
                                    "-i",
                                    temp_img,
                                    "-f",
                                    "lavfi",
                                    "-i",
                                    "anullsrc=channel_layout=stereo:sample_rate=44100",
                                    "-t",
                                    "5",
                                    "-c:v",
                                    "libx264",
                                    "-preset",
                                    "ultrafast",
                                    "-c:a",
                                    "aac",
                                    "-pix_fmt",
                                    "yuv420p",
                                    "-shortest",
                                    cached_vid,
                                ]
                                subprocess.run(
                                    cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
                                )
                            finally:
                                if os.path.exists(temp_img):
                                    os.remove(temp_img)

                        import shutil

                        shutil.copy(cached_vid, temp_vid)
                        day_member_videos.append(temp_vid)
                    except Exception as e:
                        logger.error(
                            f"Failed to create card video for user {uid} on {date_str}: {e}"
                        )
                        raise e

            day_output = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
            temp_files_to_clean.append(day_output)

            try:
                create_daily_vstack_video(day_member_videos, day_output)
                daily_video_paths.append(day_output)
            except Exception as e:
                logger.error(f"Failed to create daily vstack for {date_str}: {e}")
                raise e

        # 4. 일일 영상들을 하나로 concat
        if not daily_video_paths:
            logger.warning(f"No videos combined for project {project_id}")
            project.merged_vlog_status = "none"
            db.commit()
            return

        final_filename = f"merged_{project_id}.mp4"
        final_output_path = os.path.join(vlog_dir, final_filename)

        concat_videos(daily_video_paths, final_output_path)

        # 5. DB 상태 갱신
        project.merged_vlog_url = f"/static/uploads/vlogs/{final_filename}"
        project.merged_vlog_status = "completed"
        db.commit()
        logger.info(f"Successfully merged vlog for project {project_id}")

    except Exception as e:
        logger.error(f"Failed to merge videos for project {project_id}: {e}")
        try:
            project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
            if project:
                project.merged_vlog_status = "failed"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        for f in temp_files_to_clean:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass


@celery_app.task(bind=True, name="merge_practice_videos_task")
def merge_practice_videos_task(self, project_id: str):
    """연습 영상 병합 백그라운드 작업 (Celery Task Wrapper)"""
    merge_practice_videos_logic(project_id)
