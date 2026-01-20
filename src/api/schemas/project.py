from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ProjectBase(BaseModel):
    name: str

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: str
    original_filename: str
    status: TaskStatus
    created_at: datetime
    progress: int = 0
    bpm: Optional[int] = None
    stems_path: Optional[str] = None
    
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
