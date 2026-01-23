from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from src.api.database import Base


class User(Base):
    """사용자 모델 - 소셜 로그인 (Google, Kakao) 지원"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    nickname = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)
    provider = Column(String, nullable=False)  # 'google' or 'kakao'
    provider_id = Column(String, nullable=False)  # OAuth provider's unique ID

    # 추가 필드
    role = Column(String, default="user")  # 'user' or 'admin'
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    projects = relationship("ProjectModel", back_populates="owner", cascade="all, delete-orphan")
    shared_projects = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")

    # 복합 인덱스: provider와 provider_id 조합으로 빠른 조회
    __table_args__ = (Index("idx_provider_id", "provider", "provider_id"),)


class ProjectMember(Base):
    """프로젝트 협업 멤버 모델 - 특정 프로젝트를 공유받은 사용자"""

    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String, default="viewer")  # 'viewer' or 'editor'
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("ProjectModel", back_populates="members")
    user = relationship("User", back_populates="shared_projects")


class ProjectModel(Base):
    """프로젝트 모델 - 사용자별 음악 프로젝트"""

    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    original_filename = Column(String)
    status = Column(String, default="pending")
    progress = Column(Integer, default=0)
    bpm = Column(Integer, nullable=True)
    detected_key = Column(String, nullable=True)
    chord_progression = Column(String, nullable=True)  # JSON formatted string
    thumbnail_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 사용자 연결
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable=True for migration

    # Relationships
    owner = relationship("User", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    assets = relationship("ProjectAsset", back_populates="project", cascade="all, delete-orphan")


class ProjectAsset(Base):
    """프로젝트 결과물 (악보, 타브 등) 저장 모델"""

    __tablename__ = "project_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), index=True)
    asset_type = Column(String)  # 'score', 'tab'
    instrument = Column(String)  # 'vocals', 'guitar', 'bass', etc.
    content = Column(String)  # XML string for score, ASCII for tab
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("ProjectModel", back_populates="assets")
