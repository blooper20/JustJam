from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ============= User Schemas =============

class UserBase(BaseModel):
    """사용자 기본 스키마"""
    email: EmailStr
    nickname: Optional[str] = None
    profile_image: Optional[str] = None


class UserCreate(UserBase):
    """사용자 생성 스키마 (OAuth 로그인 시 사용)"""
    provider: str  # 'google' or 'kakao'
    provider_id: str


class UserUpdate(BaseModel):
    """사용자 업데이트 스키마"""
    nickname: Optional[str] = None
    profile_image: Optional[str] = None


class UserResponse(UserBase):
    """사용자 응답 스키마"""
    id: int
    provider: str
    role: str
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============= Auth Schemas =============

class LoginRequest(BaseModel):
    """로그인 요청 스키마"""
    email: EmailStr
    provider: str  # 'google' or 'kakao'
    provider_id: str
    nickname: Optional[str] = None
    profile_image: Optional[str] = None


class TokenResponse(BaseModel):
    """토큰 응답 스키마"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """토큰 갱신 요청 스키마"""
    refresh_token: str


class TokenData(BaseModel):
    """JWT 토큰 데이터 스키마"""
    user_id: Optional[int] = None
    email: Optional[str] = None
