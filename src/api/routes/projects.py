from fastapi import APIRouter, BackgroundTasks, Depends, File, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi_cache.decorator import cache
from sqlalchemy.orm import Session
from typing import List, Optional

from src.api.database import get_db
from src.api.dependencies import get_current_user, get_optional_current_user
from src.api.models import User
from src.api.schemas.project import (
    Project,
    ProjectMember as ProjectMemberSchema,
    ProjectShareRequest,
    ProjectUpdate,
    StemFiles,
    MixRequest,
)
from src.api.services.project_service import ProjectService, generate_thumbnail, process_audio_task

router = APIRouter()


@router.post(
    "/",
    # response_model=Project, # Remove to avoid circular dependency or use strings if needed, but Project is imported
    summary="새 프로젝트 생성",
    description="음원을 업로드하여 새로운 프로젝트를 생성합니다.",
)
async def create_project(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project, file_path = ProjectService.create_project(db, file.filename, file.file, current_user)
    
    # 썸네일 생성 백그라운드 작업
    from src.api.services.project_service import UPLOAD_DIR
    import os
    thumbnail_filename = f"thumb_{project.id}.png"
    thumbnail_path = os.path.join(UPLOAD_DIR, thumbnail_filename)
    background_tasks.add_task(generate_thumbnail, file_path, thumbnail_path)
    
    project.thumbnail_url = f"/static/uploads/{thumbnail_filename}"
    db.commit()
    
    return project


@router.post("/{project_id}/process", summary="음원 분리 시작")
async def process_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    from src.api.services.project_service import process_audio_task, process_audio_logic
    from src.api.models import ProjectModel
    from src.api.schemas.project import TaskStatus
    
    # 1. DB 상태를 즉시 PROCESSING으로 변경하여 프론트엔드 폴링 유도
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.status = TaskStatus.PROCESSING.value
    project.progress = 0
    db.commit()

    # 2. Celery 작업 호출 (로컬 개발 환경에서는 Redis가 없을 수 있으므로 짧은 타임아웃 적용 시도)
    try:
        # delay()는 비동기지만, 브로커 연결 실패 시 에러가 발생할 수 있음
        # 여기서는 단순히 시도하고 실패하면 바로 BackgroundTasks로 전환
        process_audio_task.apply_async(args=[project_id], connect_timeout=1)
        return {"message": "Processing started via Celery", "status": "processing"}
    except Exception as e:
        from src.api.logging_config import logger
        logger.warning(f"Celery start failed (Redis down?), using BackgroundTasks instead: {e}")
        background_tasks.add_task(process_audio_logic, project_id)
        return {"message": "Processing started via BackgroundTasks", "status": "processing"}



@router.get("/{project_id}", response_model=Project)
@cache(expire=300)
async def get_project(
    project_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService.get_project(db, project_id, current_user)


@router.get("/", response_model=List[Project])
@cache(expire=60)
async def list_projects(
    q: Optional[str] = None,
    sort: str = "newest",
    skip: int = 0,
    limit: int = 50,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService.list_projects(db, current_user, q, sort, skip, limit)


@router.post("/{project_id}/clone", response_model=Project)
async def clone_project(
    project_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService.clone_project(db, project_id, current_user)


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    project_update: ProjectUpdate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService.update_project(db, project_id, project_update.name, current_user)


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return ProjectService.delete_project(db, project_id, current_user)


@router.get("/{project_id}/stems", response_model=StemFiles)
async def get_project_stems(
    project_id: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService.get_project_stems(db, project_id, current_user)


@router.post("/{project_id}/score/{instrument}")
async def generate_project_score(
    project_id: str,
    instrument: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    content, cached = ProjectService.generate_score(db, project_id, instrument, current_user)
    headers = {"X-Cache": "HIT"} if cached else {}
    return Response(content=content, media_type="application/xml", headers=headers)


@router.post("/{project_id}/midi/{instrument}")
async def generate_project_midi(
    project_id: str,
    instrument: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    midi_bytes, cached = ProjectService.generate_midi(db, project_id, instrument, current_user)
    headers = {"X-Cache": "HIT"} if cached else {}
    return Response(content=midi_bytes, media_type="audio/midi", headers=headers)


@router.post("/{project_id}/tabs/{instrument}")
async def generate_project_tab(
    project_id: str,
    instrument: str,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    result, cached = ProjectService.generate_tab(db, project_id, instrument, current_user)
    headers = {"X-Cache": "HIT"} if cached else {}
    return JSONResponse(content=result, headers=headers)


@router.post("/{project_id}/mix")
async def mix_audio(
    project_id: str,
    request: MixRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> dict:
    url = ProjectService.mix_audio(db, project_id, request, current_user)
    return {"url": url}


# --- 협업 관련 엔드포인트 ---

@router.post("/{project_id}/share", response_model=ProjectMemberSchema)
async def share_project(
    project_id: str,
    share_request: ProjectShareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService.share_project(db, project_id, share_request.email, share_request.role, current_user)


@router.get("/{project_id}/members", response_model=List[ProjectMemberSchema])
async def list_project_members(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return ProjectService.list_members(db, project_id, current_user)


@router.delete("/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: str,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return ProjectService.remove_member(db, project_id, user_id, current_user)

