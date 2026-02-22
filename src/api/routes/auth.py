"""
인증 관련 API 라우트
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from src.api.database import get_db
from src.api.dependencies import get_current_user
from src.api.limiter import limiter
from src.api.models import User
from src.api.schemas.user import LoginRequest, RefreshTokenRequest, TokenResponse, UserResponse
from src.api.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="소셜 로그인",
    responses={
        200: {"description": "로그인 성공 및 토큰 반환"},
        429: {"description": "요청 한도 초과 (Rate limit exceeded)"},
    },
)
@limiter.limit("5/minute")
async def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    소셜 로그인 (Google, Kakao)

    프론트엔드에서 OAuth 인증 후 사용자 정보를 받아 처리합니다.
    - 기존 사용자: 로그인 시간 업데이트 후 토큰 발급
    - 신규 사용자: 계정 생성 후 토큰 발급

    Args:
        login_data: 로그인 요청 데이터 (email, provider, provider_id 등)
        db: 데이터베이스 세션

    Returns:
        TokenResponse: access_token, refresh_token, 사용자 정보
    """
    return AuthService.login(db, login_data)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="토큰 갱신",
    responses={
        200: {"description": "토큰 갱신 성공"},
        401: {"description": "유효하지 않은 Refresh Token"},
    },
)
async def refresh_access_token(refresh_data: RefreshTokenRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Refresh Token으로 새로운 Access Token 발급

    Args:
        refresh_data: refresh_token을 포함한 요청 데이터
        db: 데이터베이스 세션

    Returns:
        TokenResponse: 새로운 access_token과 refresh_token

    Raises:
        HTTPException: 유효하지 않은 refresh token인 경우 401 에러
    """
    return AuthService.refresh_token(db, refresh_data.refresh_token)



@router.post("/logout", summary="로그아웃")
async def logout(current_user: User = Depends(get_current_user)) -> dict:
    """
    로그아웃

    현재는 클라이언트 측에서 토큰을 삭제하는 것으로 처리합니다.
    향후 Redis를 사용한 토큰 블랙리스트 기능을 추가할 수 있습니다.

    Args:
        current_user: 현재 인증된 사용자

    Returns:
        성공 메시지
    """
    return {"message": "로그아웃되었습니다", "user_id": current_user.id}
