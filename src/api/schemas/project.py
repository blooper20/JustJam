from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProjectBase(BaseModel):
    name: str


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None


class ProjectMemberBase(BaseModel):
    user_id: int
    role: str  # 'viewer' or 'editor'


class ProjectMember(ProjectMemberBase):
    id: int
    project_id: str
    created_at: datetime
    email: Optional[str] = None  # Helper for frontend
    nickname: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectShareRequest(BaseModel):
    email: str
    role: str = "viewer"


class Project(ProjectBase):
    id: str
    original_filename: str
    status: TaskStatus
    created_at: datetime
    progress: int = 0
    bpm: Optional[int] = None
    detected_key: Optional[str] = None
    chord_progression: Optional[str] = None
    thumbnail_url: Optional[str] = None
    stems_path: Optional[str] = None
    has_score: bool = False
    has_tab: bool = False
    score_instruments: List[str] = []
    tab_instruments: List[str] = []
    members: List[ProjectMember] = []
    is_owner: bool = False  # Helper for frontend

    class Config:
        from_attributes = True


class StemFiles(BaseModel):
    vocals: Optional[str] = None
    bass: Optional[str] = None
    drums: Optional[str] = None
    guitar: Optional[str] = None
    piano: Optional[str] = None
    other: Optional[str] = None
    master: Optional[str] = None
