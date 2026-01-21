"""
JWT 토큰 생성 및 검증 모듈
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os

# 환경 변수에서 설정 가져오기 (기본값 제공)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this-in-production-min-32-chars")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Access Token 생성
    
    Args:
        data: JWT 페이로드에 포함할 데이터 (예: {"user_id": 1, "email": "user@example.com"})
        expires_delta: 만료 시간 (기본값: 15분)
    
    Returns:
        JWT 액세스 토큰 문자열
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Refresh Token 생성
    
    Args:
        data: JWT 페이로드에 포함할 데이터
    
    Returns:
        JWT 리프레시 토큰 문자열
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """
    JWT 토큰 검증 및 디코딩
    
    Args:
        token: 검증할 JWT 토큰
        token_type: 토큰 타입 ('access' or 'refresh')
    
    Returns:
        디코딩된 페이로드 또는 None (검증 실패 시)
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 토큰 타입 확인
        if payload.get("type") != token_type:
            return None
        
        return payload
    
    except JWTError:
        return None


def decode_token(token: str) -> Optional[dict]:
    """
    JWT 토큰 디코딩 (검증 없이)
    
    Args:
        token: 디코딩할 JWT 토큰
    
    Returns:
        디코딩된 페이로드 또는 None
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_signature": False})
        return payload
    except JWTError:
        return None
