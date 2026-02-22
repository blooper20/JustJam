"""
인증 서비스 레이어
"""

from datetime import datetime
from sqlalchemy.orm import Session
from src.api.auth.jwt import create_access_token, create_refresh_token, verify_token
from src.api.exceptions import AuthenticationError, InvalidTokenError
from src.api.models import User
from src.api.schemas.user import LoginRequest, TokenResponse, UserResponse


class AuthService:
    @staticmethod
    def login(db: Session, login_data: LoginRequest) -> TokenResponse:
        """
        소셜 로그인 처리
        """
        # 기존 사용자 확인
        user = (
            db.query(User)
            .filter(User.provider == login_data.provider, User.provider_id == login_data.provider_id)
            .first()
        )

        if user:
            # 기존 사용자: 로그인 시간 업데이트
            user.last_login = datetime.utcnow()

            # 이메일이나 프로필 정보가 변경되었을 수 있으므로 업데이트
            user.email = login_data.email
            if login_data.nickname:
                user.nickname = login_data.nickname
            if login_data.profile_image:
                user.profile_image = login_data.profile_image

            db.commit()
            db.refresh(user)
        else:
            # 신규 사용자: 계정 생성
            user = User(
                email=login_data.email,
                nickname=login_data.nickname,
                profile_image=login_data.profile_image,
                provider=login_data.provider,
                provider_id=login_data.provider_id,
                last_login=datetime.utcnow(),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # JWT 토큰 생성
        token_data = {"user_id": user.id, "email": user.email}

        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.from_orm(user)
        )

    @staticmethod
    def refresh_token(db: Session, refresh_token: str) -> TokenResponse:
        """
        Refresh Token으로 새로운 Access Token 발급
        """
        # Refresh Token 검증
        payload = verify_token(refresh_token, token_type="refresh")

        if payload is None:
            raise InvalidTokenError(detail="유효하지 않은 refresh token입니다")

        user_id = payload.get("user_id")
        if user_id is None:
            raise InvalidTokenError(detail="토큰에서 사용자 정보를 찾을 수 없습니다")

        # 사용자 확인
        user = (
            db.query(User)
            .filter(User.id == user_id, User.is_active == True, User.deleted_at == None)
            .first()
        )

        if user is None:
            raise AuthenticationError(detail="사용자를 찾을 수 없습니다")

        # 새로운 토큰 생성
        token_data = {"user_id": user.id, "email": user.email}

        new_access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)

        return TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            user=UserResponse.from_orm(user),
        )
