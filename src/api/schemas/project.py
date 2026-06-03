from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ProjectBase(BaseModel):
    name: str = Field(..., example="My New Project")


class ProjectCreate(ProjectBase):
    team_id: int = Field(..., example=1)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, example="Updated Project Name")
    practice_deadline: Optional[str] = Field(None, example="2026-06-30")


class ProjectMemberBase(BaseModel):
    user_id: int = Field(..., example=1)
    role: str = Field(..., example="viewer")  # 'viewer' or 'editor'
    instrument: Optional[str] = Field(None, example="vocal")


class ProjectMemberInstrumentUpdate(BaseModel):
    instrument: Optional[str] = Field(None, example="vocal")


class ProjectMember(ProjectMemberBase):
    id: int = Field(..., example=1)
    project_id: str = Field(..., example="123e4567-e89b-12d3-a456-426614174000")
    created_at: datetime
    email: Optional[str] = Field(None, example="member@example.com")  # Helper for frontend
    nickname: Optional[str] = Field(None, example="Collaborator")

    class Config:
        from_attributes = True


class ProjectShareRequest(BaseModel):
    email: str = Field(..., example="friend@example.com")
    role: str = Field("viewer", example="editor")


class Project(ProjectBase):
    id: str = Field(..., example="123e4567-e89b-12d3-a456-426614174000")
    team_id: Optional[int] = Field(None, example=1)
    original_filename: str = Field(..., example="awesome_track.mp3")
    status: TaskStatus = Field(..., example=TaskStatus.COMPLETED)
    status_text: Optional[str] = Field(None, example="분석 중...")
    created_at: datetime
    progress: int = Field(0, example=100)
    bpm: Optional[int] = Field(None, example=120)
    detected_key: Optional[str] = Field(None, example="C Major")
    chord_progression: Optional[str] = Field(None, example='["C", "G", "Am", "F"]')
    structure: Optional[str] = Field(None, example='[{"name": "Intro", "start": 0, "end": 10}]')
    thumbnail_url: Optional[str] = Field(None, example="/static/uploads/thumb_123.png")
    stems_path: Optional[str] = Field(None, example="/static/separated/htdemucs_6s/123")
    members: List[ProjectMember] = []
    is_owner: bool = Field(False, example=True)  # Helper for frontend
    practice_deadline: Optional[str] = Field(None, example="2026-06-30")
    merged_vlog_url: Optional[str] = Field(None, example="/static/uploads/vlogs/merged_123.mp4")
    merged_vlog_status: Optional[str] = Field("none", example="completed")

    class Config:
        from_attributes = True


class StemFiles(BaseModel):
    vocals: Optional[str] = Field(None, example="/static/separated/htdemucs_6s/123/vocals.wav")
    bass: Optional[str] = Field(None, example="/static/separated/htdemucs_6s/123/bass.wav")
    drums: Optional[str] = Field(None, example="/static/separated/htdemucs_6s/123/drums.wav")
    guitar: Optional[str] = Field(None, example="/static/separated/htdemucs_6s/123/guitar.wav")
    piano: Optional[str] = Field(None, example="/static/separated/htdemucs_6s/123/piano.wav")
    other: Optional[str] = Field(None, example="/static/separated/htdemucs_6s/123/other.wav")
    master: Optional[str] = Field(None, example="/static/separated/htdemucs_6s/123/master.wav")


class MixRequest(BaseModel):
    volumes: Dict[str, float]
    bpm: float
    metronome: float
    start_offset: float = 0.0
