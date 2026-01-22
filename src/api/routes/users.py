"""
사용자 관리 API 라우트
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.database import get_db
from src.api.dependencies import get_current_user
from src.api.models import User
from src.api.schemas.user import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse, summary="현재 사용자 정보 조회")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    현재 로그인한 사용자의 정보를 조회합니다.

    Args:
        current_user: 현재 인증된 사용자

    Returns:
        UserResponse: 사용자 정보
    """
    return UserResponse.from_orm(current_user)


@router.patch("/me", response_model=UserResponse, summary="사용자 프로필 업데이트")
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    현재 로그인한 사용자의 프로필을 업데이트합니다.

    Args:
        user_update: 업데이트할 사용자 정보 (nickname, profile_image)
        current_user: 현재 인증된 사용자
        db: 데이터베이스 세션

    Returns:
        UserResponse: 업데이트된 사용자 정보
    """
    # 업데이트할 필드만 적용
    if user_update.nickname is not None:
        current_user.nickname = user_update.nickname

    if user_update.profile_image is not None:
        current_user.profile_image = user_update.profile_image

    db.commit()
    db.refresh(current_user)

    return UserResponse.from_orm(current_user)


@router.delete("/me", summary="계정 삭제 (Soft Delete)")
async def delete_current_user(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
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
    # Soft Delete: deleted_at 필드에 현재 시간 기록
    current_user.deleted_at = datetime.utcnow()
    current_user.is_active = False

    db.commit()

    return {
        "message": "계정이 삭제되었습니다",
        "user_id": current_user.id,
        "deleted_at": current_user.deleted_at,
    }
