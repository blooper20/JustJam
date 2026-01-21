"""
FastAPI 의존성 함수들
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional

from src.api.database import get_db
from src.api.models import User
from src.api.auth.jwt import verify_token

# HTTP Bearer 토큰 스키마
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    현재 인증된 사용자 가져오기
    
    Args:
        credentials: HTTP Authorization 헤더의 Bearer 토큰
        db: 데이터베이스 세션
    
    Returns:
        인증된 User 객체
    
    Raises:
        HTTPException: 인증 실패 시 401 에러
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보를 확인할 수 없습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 토큰 검증
    token = credentials.credentials
    payload = verify_token(token, token_type="access")
    
    if payload is None:
        raise credentials_exception
    
    user_id: Optional[int] = payload.get("user_id")
    if user_id is None:
        raise credentials_exception
    
    # 데이터베이스에서 사용자 조회
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True,
        User.deleted_at == None
    ).first()
    
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    현재 활성화된 사용자 가져오기
    
    Args:
        current_user: get_current_user에서 가져온 사용자
    
    Returns:
        활성화된 User 객체
    
    Raises:
        HTTPException: 사용자가 비활성화된 경우 400 에러
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비활성화된 사용자입니다"
        )
    return current_user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    선택적으로 현재 사용자 가져오기 (인증 없이도 접근 가능한 엔드포인트용)
    
    Args:
        credentials: HTTP Authorization 헤더의 Bearer 토큰 (선택적)
        db: 데이터베이스 세션
    
    Returns:
        인증된 User 객체 또는 None
    """
    if credentials is None:
        return None
    
    token = credentials.credentials
    payload = verify_token(token, token_type="access")
    
    if payload is None:
        return None
    
    user_id: Optional[int] = payload.get("user_id")
    if user_id is None:
        return None
    
    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True,
        User.deleted_at == None
    ).first()
    
    return user
