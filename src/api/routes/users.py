"""
사용자 관리 API 라우트
"""

from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from src.api.database import get_db
from src.api.dependencies import get_current_user
from src.api.models import User
from src.api.schemas.user import UserResponse, UserUpdate

from src.api.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse, summary="현재 사용자 정보 조회")
async def get_current_user_info(current_user: User = Depends(get_current_user)) -> UserResponse:
    """
    현재 로그인한 사용자의 정보를 조회합니다.

    Args:
        current_user: 현재 인증된 사용자

    Returns:
        UserResponse: 사용자 정보
    """
    return UserService.get_user_info(current_user)


@router.patch("/me", response_model=UserResponse, summary="사용자 프로필 업데이트")
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    현재 로그인한 사용자의 프로필을 업데이트합니다.

    Args:
        user_update: 업데이트할 사용자 정보 (nickname, profile_image)
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        UserResponse: 업데이트된 사용자 정보
    """
    return UserService.update_user(db, current_user, user_update)


@router.post("/me/profile-image", response_model=UserResponse, summary="프로필 이미지 업로드")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """
    프로필 이미지를 업로드합니다.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")
        
    return UserService.upload_profile_image(db, current_user, file.filename, file.file)


@router.delete("/me", summary="계정 삭제 (Soft Delete)")
async def delete_current_user(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    """
    현재 로그인한 사용자의 계정을 삭제합니다 (Soft Delete).

    실제로 데이터를 삭제하지 않고 deleted_at 필드에 삭제 시간을 기록합니다.
    이를 통해 필요 시 계정을 복구할 수 있습니다.

    Args:
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        성공 메시지
    """
    return UserService.delete_user(db, current_user)

