from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from src.api.schemas.user import UserResponse

# ============= Comment Schemas =============


class CollaborationCommentCreate(BaseModel):
    content: str = Field(..., min_length=1)


class CollaborationCommentResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    content: str
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True


# ============= Voting & Options Schemas =============


class PostOptionCreate(BaseModel):
    option_text: str = Field(..., min_length=1)
    youtube_url: Optional[str] = None


class PostOptionResponse(BaseModel):
    id: int
    post_id: int
    option_text: str
    youtube_url: Optional[str] = None
    votes_count: int = 0
    voted_user_ids: List[int] = []

    class Config:
        from_attributes = True


class UserVoteResponse(BaseModel):
    id: int
    option_id: int
    user_id: int

    class Config:
        from_attributes = True


# ============= Scheduling Schemas =============


class PostScheduleTimeCreate(BaseModel):
    time_slot: str = Field(..., example="2026-06-01 14:00")


class PostScheduleTimeResponse(BaseModel):
    id: int
    post_id: int
    time_slot: str
    availabilities_count: int = 0
    available_user_ids: List[int] = []

    class Config:
        from_attributes = True


class UserAvailabilityResponse(BaseModel):
    id: int
    schedule_time_id: int
    user_id: int

    class Config:
        from_attributes = True


# ============= Post Schemas =============


class CollaborationPostCreate(BaseModel):
    title: str = Field(..., min_length=1)
    content: Optional[str] = Field(None)
    post_type: str = Field("general", pattern="^(general|vote|schedule)$")
    youtube_url: Optional[str] = None
    options: Optional[List[PostOptionCreate]] = None  # Required if post_type is 'vote'
    schedule_times: Optional[List[str]] = None  # Required if post_type is 'schedule'


class CollaborationPostResponse(BaseModel):
    id: int
    team_id: Optional[int] = None
    project_id: Optional[str] = None
    user_id: int
    title: str
    content: str
    post_type: str
    youtube_url: Optional[str] = None
    confirmed_time: Optional[str] = None
    created_at: datetime
    user: UserResponse
    comments: List[CollaborationCommentResponse] = []
    options: List[PostOptionResponse] = []
    schedule_times: List[PostScheduleTimeResponse] = []

    class Config:
        from_attributes = True


# ============= Practice Log / Vlog Schemas =============


class PracticeLogCreate(BaseModel):
    description: Optional[str] = None
    logged_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", example="2026-05-28")


class PracticeLogCommentResponse(BaseModel):
    id: int
    practice_log_id: int
    user_id: int
    content: str
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True


class PracticeLogCommentCreate(BaseModel):
    content: str


class PracticeLogResponse(BaseModel):
    id: int
    project_id: str
    user_id: int
    video_url: str
    raw_video_url: Optional[str] = None
    start_time: Optional[float] = 0.0
    overlay_text: Optional[str] = None
    description: Optional[str]
    logged_date: str
    created_at: datetime
    user: UserResponse
    comments: List[PracticeLogCommentResponse] = []

    class Config:
        from_attributes = True


class ConfirmTimeRequest(BaseModel):
    confirmed_time: Optional[str] = None
