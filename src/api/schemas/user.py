from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

# ============= User Schemas =============


class UserBase(BaseModel):
    """사용자 기본 스키마"""

    email: EmailStr = Field(..., example="user@example.com")
    nickname: Optional[str] = Field(None, example="JustJammer")
    profile_image: Optional[str] = Field(None, example="https://example.com/profile.jpg")


class UserCreate(UserBase):
    """사용자 생성 스키마 (OAuth 로그인 시 사용)"""

    provider: str = Field(..., example="google")  # 'google' or 'kakao'
    provider_id: str = Field(..., example="123456789")


class UserUpdate(BaseModel):
    """사용자 업데이트 스키마"""

    nickname: Optional[str] = Field(None, example="NewNickname")
    profile_image: Optional[str] = Field(None, example="https://example.com/new_profile.jpg")


class UserResponse(UserBase):
    """사용자 응답 스키마"""

    id: int = Field(..., example=1)
    provider: str = Field(..., example="google")
    role: str = Field(..., example="user")
    is_active: bool = Field(..., example=True)
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============= Auth Schemas =============


class LoginRequest(BaseModel):
    """로그인 요청 스키마"""

    email: EmailStr = Field(..., example="user@example.com")
    provider: str = Field(..., example="google")  # 'google' or 'kakao'
    provider_id: str = Field(..., example="123456789")
    nickname: Optional[str] = Field(None, example="JustJammer")
    profile_image: Optional[str] = Field(None, example="https://example.com/profile.jpg")


class TokenResponse(BaseModel):
    """토큰 응답 스키마"""

    access_token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    refresh_token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    token_type: str = Field("bearer", example="bearer")
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """토큰 갱신 요청 스키마"""

    refresh_token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")


class TokenData(BaseModel):
    """JWT 토큰 데이터 스키마"""

    user_id: Optional[int] = Field(None, example=1)
    email: Optional[str] = Field(None, example="user@example.com")
