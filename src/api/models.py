from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String
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
    owned_teams = relationship("Team", back_populates="owner", cascade="all, delete-orphan")
    team_memberships = relationship(
        "TeamMember", back_populates="user", cascade="all, delete-orphan"
    )
    shared_projects = relationship(
        "ProjectMember", back_populates="user", cascade="all, delete-orphan"
    )
    posts = relationship("CollaborationPost", back_populates="user", cascade="all, delete-orphan")
    comments = relationship(
        "CollaborationComment", back_populates="user", cascade="all, delete-orphan"
    )
    votes = relationship("UserVote", back_populates="user", cascade="all, delete-orphan")
    availabilities = relationship(
        "UserAvailability", back_populates="user", cascade="all, delete-orphan"
    )
    practice_logs = relationship("PracticeLog", back_populates="user", cascade="all, delete-orphan")

    # 복합 인덱스: provider와 provider_id 조합으로 빠른 조회
    __table_args__ = (Index("idx_provider_id", "provider", "provider_id"),)


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="owned_teams")
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    projects = relationship("ProjectModel", back_populates="team", cascade="all, delete-orphan")
    posts = relationship("CollaborationPost", back_populates="team", cascade="all, delete-orphan")


class TeamMember(Base):
    __tablename__ = "team_members"
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String, default="viewer")  # 'owner', 'editor', 'viewer'
    instrument = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")


class ProjectMember(Base):
    """프로젝트 협업 멤버 모델 - 특정 프로젝트를 공유받은 사용자"""

    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String, default="viewer")  # 'viewer' or 'editor'
    instrument = Column(
        String, nullable=True
    )  # 'vocal', 'keyboard', 'drum', 'guitar', 'bass', etc.
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
    status_text = Column(String, nullable=True)
    progress = Column(Integer, default=0)
    bpm = Column(Integer, nullable=True)
    detected_key = Column(String, nullable=True)
    chord_progression = Column(String, nullable=True)  # JSON formatted string
    structure = Column(String, nullable=True)  # JSON formatted string
    thumbnail_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 사용자 연결
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=True)

    # Relationships
    owner = relationship("User", back_populates="projects")
    team = relationship("Team", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    posts = relationship(
        "CollaborationPost", back_populates="project", cascade="all, delete-orphan"
    )
    practice_logs = relationship(
        "PracticeLog", back_populates="project", cascade="all, delete-orphan"
    )


class CollaborationPost(Base):
    """협업 보드 포스트 모델 (공지, 투표, 일정 공유 등)"""

    __tablename__ = "collaboration_posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=True)
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    post_type = Column(String, default="general")  # 'general', 'vote', 'schedule'
    youtube_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("ProjectModel", back_populates="posts")
    team = relationship("Team", back_populates="posts")
    user = relationship("User", back_populates="posts")
    comments = relationship(
        "CollaborationComment", back_populates="post", cascade="all, delete-orphan"
    )
    options = relationship("PostOption", back_populates="post", cascade="all, delete-orphan")
    schedule_times = relationship(
        "PostScheduleTime", back_populates="post", cascade="all, delete-orphan"
    )


class CollaborationComment(Base):
    """협업 포스트의 댓글 모델"""

    __tablename__ = "collaboration_comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(
        Integer,
        ForeignKey("collaboration_posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    post = relationship("CollaborationPost", back_populates="comments")
    user = relationship("User", back_populates="comments")


class PostOption(Base):
    """투표 포스트의 선택 항목 모델"""

    __tablename__ = "post_options"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(
        Integer,
        ForeignKey("collaboration_posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    option_text = Column(String, nullable=False)
    youtube_url = Column(String, nullable=True)

    # Relationships
    post = relationship("CollaborationPost", back_populates="options")
    votes = relationship("UserVote", back_populates="option", cascade="all, delete-orphan")


class UserVote(Base):
    """투표 포스트의 사용자 투표 모델"""

    __tablename__ = "user_votes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    option_id = Column(
        Integer, ForeignKey("post_options.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Relationships
    option = relationship("PostOption", back_populates="votes")
    user = relationship("User", back_populates="votes")


class PostScheduleTime(Base):
    """일정 조율 포스트의 후보 시간대 모델"""

    __tablename__ = "post_schedule_times"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(
        Integer,
        ForeignKey("collaboration_posts.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    time_slot = Column(String, nullable=False)  # e.g., "2026-06-01 14:00"

    # Relationships
    post = relationship("CollaborationPost", back_populates="schedule_times")
    availabilities = relationship(
        "UserAvailability", back_populates="schedule_time", cascade="all, delete-orphan"
    )


class UserAvailability(Base):
    """사용자의 후보 시간대별 가능 여부 모델"""

    __tablename__ = "user_availabilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_time_id = Column(
        Integer,
        ForeignKey("post_schedule_times.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # Relationships
    schedule_time = relationship("PostScheduleTime", back_populates="availabilities")
    user = relationship("User", back_populates="availabilities")


class PracticeLog(Base):
    """사용자의 개인/팀 연습 기록 및 브이로그 인증 모델"""

    __tablename__ = "practice_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=True)
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    video_url = Column(String, nullable=False)
    raw_video_url = Column(String, nullable=True)
    start_time = Column(Float, nullable=True, default=0.0)
    overlay_text = Column(String, nullable=True)
    description = Column(String, nullable=True)
    logged_date = Column(String, nullable=False)  # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("ProjectModel", back_populates="practice_logs")
    user = relationship("User", back_populates="practice_logs")
