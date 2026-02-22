"""
사용자 관리 서비스 레이어
"""

from datetime import datetime
from sqlalchemy.orm import Session
from src.api.models import User
from src.api.schemas.user import UserResponse, UserUpdate


class UserService:
    @staticmethod
    def get_user_info(user: User) -> UserResponse:
        """
        현재 사용자 정보 반환
        """
        return UserResponse.from_orm(user)

    @staticmethod
    def update_user(db: Session, user: User, user_update: UserUpdate) -> UserResponse:
        """
        사용자 프로필 업데이트
        """
        if user_update.nickname is not None:
            user.nickname = user_update.nickname

        if user_update.profile_image is not None:
            user.profile_image = user_update.profile_image

        db.commit()
        db.refresh(user)

        return UserResponse.from_orm(user)

    @staticmethod
    def upload_profile_image(db: Session, user: User, file_name: str, file_content) -> UserResponse:
        import os
        import shutil
        import uuid
        
        # 프로젝트 루트의 temp/uploads와 동일한 경로 사용 또는 별도 profile_images 디렉터리
        from src.api.services.project_service import UPLOAD_DIR
        
        file_ext = os.path.splitext(file_name)[1]
        saved_filename = f"profile_{user.id}_{uuid.uuid4().hex[:8]}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, saved_filename)
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file_content, buffer)
        except Exception as e:
            from src.api.exceptions import FileUploadError
            raise FileUploadError(detail=f"프로필 이미지 업로드 실패: {str(e)}")
            
        user.profile_image = f"/static/uploads/{saved_filename}"
        db.commit()
        db.refresh(user)
        
        return UserResponse.from_orm(user)

    @staticmethod
    def delete_user(db: Session, user: User) -> dict:
        """
        사용자 계정 삭제 (Soft Delete)
        """
        user.deleted_at = datetime.utcnow()
        user.is_active = False

        db.commit()

        return {
            "message": "계정이 삭제되었습니다",
            "user_id": user.id,
            "deleted_at": user.deleted_at,
        }
