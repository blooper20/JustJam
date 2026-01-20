from sqlalchemy import Column, String, Integer, DateTime
from src.api.database import Base
from datetime import datetime

class ProjectModel(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    original_filename = Column(String)
    status = Column(String, default="pending")
    progress = Column(Integer, default=0)
    bpm = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
