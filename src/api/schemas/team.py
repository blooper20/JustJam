from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class TeamBase(BaseModel):
    name: str = Field(..., example="My Band")


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, example="New Band Name")


class TeamMemberBase(BaseModel):
    user_id: int
    role: str = Field(..., example="viewer")
    instrument: Optional[str] = Field(None, example="vocal")


class TeamMemberResponse(TeamMemberBase):
    id: int
    team_id: int
    created_at: datetime
    email: Optional[str] = None
    nickname: Optional[str] = None

    class Config:
        from_attributes = True


class TeamResponse(TeamBase):
    id: int
    owner_id: int
    created_at: datetime
    members: List[TeamMemberResponse] = []
    is_owner: bool = False

    class Config:
        from_attributes = True


class TeamMemberInstrumentUpdate(BaseModel):
    instrument: Optional[str] = Field(None, example="vocal")
