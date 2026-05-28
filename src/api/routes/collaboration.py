import os
import shutil
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from src.api.database import get_db
from src.api.dependencies import get_current_user
from src.api.models import (
    CollaborationComment,
    CollaborationPost,
    PostOption,
    PostScheduleTime,
    PracticeLog,
    ProjectMember,
    ProjectModel,
    User,
    UserAvailability,
    UserVote,
)
from src.api.schemas.collaboration import (
    CollaborationCommentCreate,
    CollaborationCommentResponse,
    CollaborationPostCreate,
    CollaborationPostResponse,
    PracticeLogResponse,
)
from src.api.schemas.user import UserResponse

router = APIRouter(prefix="/projects/{project_id}", tags=["Collaboration"])


def check_project_access(db: Session, project_id: str, current_user: User) -> ProjectModel:
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.user_id == current_user.id
    is_member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id)
        .first()
        is not None
    )
    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="이 프로젝트에 접근할 권한이 없습니다.")

    return project


# ============= Posts Routes =============


@router.get(
    "/posts", response_model=List[CollaborationPostResponse], summary="협업 포스트 목록 조회"
)
async def list_posts(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    posts = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.project_id == project_id)
        .options(
            joinedload(CollaborationPost.user),
            joinedload(CollaborationPost.comments).joinedload(CollaborationComment.user),
            joinedload(CollaborationPost.options).joinedload(PostOption.votes),
            joinedload(CollaborationPost.schedule_times).joinedload(
                PostScheduleTime.availabilities
            ),
        )
        .order_by(CollaborationPost.created_at.desc())
        .all()
    )

    # Map extra statistics for response models
    for post in posts:
        for opt in post.options:
            opt.votes_count = len(opt.votes)
            opt.voted_user_ids = [v.user_id for v in opt.votes]
        for st in post.schedule_times:
            st.availabilities_count = len(st.availabilities)
            st.available_user_ids = [a.user_id for a in st.availabilities]

    return posts


@router.post("/posts", response_model=CollaborationPostResponse, summary="협업 포스트 작성")
async def create_post(
    project_id: str,
    post_in: CollaborationPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    post = CollaborationPost(
        project_id=project_id,
        user_id=current_user.id,
        title=post_in.title,
        content=post_in.content,
        post_type=post_in.post_type,
    )
    db.add(post)
    db.flush()  # Obtain post.id

    if post_in.post_type == "vote" and post_in.options:
        for opt_text in post_in.options:
            option = PostOption(post_id=post.id, option_text=opt_text)
            db.add(option)

    elif post_in.post_type == "schedule" and post_in.schedule_times:
        for time_slot in post_in.schedule_times:
            sch_time = PostScheduleTime(post_id=post.id, time_slot=time_slot)
            db.add(sch_time)

    db.commit()
    db.refresh(post)

    # Reload with details
    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post.id)
        .options(
            joinedload(CollaborationPost.user),
            joinedload(CollaborationPost.comments).joinedload(CollaborationComment.user),
            joinedload(CollaborationPost.options).joinedload(PostOption.votes),
            joinedload(CollaborationPost.schedule_times).joinedload(
                PostScheduleTime.availabilities
            ),
        )
        .first()
    )

    for opt in post.options:
        opt.votes_count = 0
        opt.voted_user_ids = []
    for st in post.schedule_times:
        st.availabilities_count = 0
        st.available_user_ids = []

    return post


@router.delete("/posts/{post_id}", summary="협업 포스트 삭제")
async def delete_post(
    project_id: str,
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.project_id == project_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Only creator or project owner can delete
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if post.user_id != current_user.id and project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}


# ============= Comments Routes =============


@router.post(
    "/posts/{post_id}/comments",
    response_model=CollaborationCommentResponse,
    summary="포스트 댓글 작성",
)
async def create_comment(
    project_id: str,
    post_id: int,
    comment_in: CollaborationCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.project_id == project_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = CollaborationComment(
        post_id=post_id,
        user_id=current_user.id,
        content=comment_in.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Reload with user details
    comment = (
        db.query(CollaborationComment)
        .filter(CollaborationComment.id == comment.id)
        .options(joinedload(CollaborationComment.user))
        .first()
    )
    return comment


@router.delete("/posts/{post_id}/comments/{comment_id}", summary="포스트 댓글 삭제")
async def delete_comment(
    project_id: str,
    post_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    comment = (
        db.query(CollaborationComment)
        .filter(CollaborationComment.id == comment_id, CollaborationComment.post_id == post_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    db.delete(comment)
    db.commit()
    return {"message": "Comment deleted successfully"}


# ============= Voting & Availability Routes =============


@router.post(
    "/posts/{post_id}/vote/{option_id}",
    response_model=CollaborationPostResponse,
    summary="포스트 투표 토글",
)
async def toggle_vote(
    project_id: str,
    post_id: int,
    option_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.project_id == project_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    option = (
        db.query(PostOption)
        .filter(PostOption.id == option_id, PostOption.post_id == post_id)
        .first()
    )
    if not option:
        raise HTTPException(status_code=404, detail="Option not found")

    # Toggle vote
    existing_vote = (
        db.query(UserVote)
        .filter(UserVote.option_id == option_id, UserVote.user_id == current_user.id)
        .first()
    )

    if existing_vote:
        db.delete(existing_vote)
    else:
        vote = UserVote(option_id=option_id, user_id=current_user.id)
        db.add(vote)

    db.commit()

    # Reload updated post
    updated_post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id)
        .options(
            joinedload(CollaborationPost.user),
            joinedload(CollaborationPost.comments).joinedload(CollaborationComment.user),
            joinedload(CollaborationPost.options).joinedload(PostOption.votes),
            joinedload(CollaborationPost.schedule_times).joinedload(
                PostScheduleTime.availabilities
            ),
        )
        .first()
    )

    for opt in updated_post.options:
        opt.votes_count = len(opt.votes)
        opt.voted_user_ids = [v.user_id for v in opt.votes]
    for st in updated_post.schedule_times:
        st.availabilities_count = len(st.availabilities)
        st.available_user_ids = [a.user_id for a in st.availabilities]

    return updated_post


@router.post(
    "/posts/{post_id}/availability/{schedule_time_id}",
    response_model=CollaborationPostResponse,
    summary="후보 일정 가능 여부 토글",
)
async def toggle_availability(
    project_id: str,
    post_id: int,
    schedule_time_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.project_id == project_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    sch_time = (
        db.query(PostScheduleTime)
        .filter(PostScheduleTime.id == schedule_time_id, PostScheduleTime.post_id == post_id)
        .first()
    )
    if not sch_time:
        raise HTTPException(status_code=404, detail="Schedule time slot not found")

    # Toggle availability
    existing_avail = (
        db.query(UserAvailability)
        .filter(
            UserAvailability.schedule_time_id == schedule_time_id,
            UserAvailability.user_id == current_user.id,
        )
        .first()
    )

    if existing_avail:
        db.delete(existing_avail)
    else:
        avail = UserAvailability(schedule_time_id=schedule_time_id, user_id=current_user.id)
        db.add(avail)

    db.commit()

    # Reload updated post
    updated_post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id)
        .options(
            joinedload(CollaborationPost.user),
            joinedload(CollaborationPost.comments).joinedload(CollaborationComment.user),
            joinedload(CollaborationPost.options).joinedload(PostOption.votes),
            joinedload(CollaborationPost.schedule_times).joinedload(
                PostScheduleTime.availabilities
            ),
        )
        .first()
    )

    for opt in updated_post.options:
        opt.votes_count = len(opt.votes)
        opt.voted_user_ids = [v.user_id for v in opt.votes]
    for st in updated_post.schedule_times:
        st.availabilities_count = len(st.availabilities)
        st.available_user_ids = [a.user_id for a in st.availabilities]

    return updated_post


# ============= Practice Calendar & Vlog Routes =============


@router.get(
    "/practice-logs", response_model=List[PracticeLogResponse], summary="연습 일지 목록 조회"
)
async def list_practice_logs(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    logs = (
        db.query(PracticeLog)
        .filter(PracticeLog.project_id == project_id)
        .options(joinedload(PracticeLog.user))
        .order_by(PracticeLog.logged_date.desc(), PracticeLog.created_at.desc())
        .all()
    )
    return logs


@router.post(
    "/practice-logs",
    response_model=PracticeLogResponse,
    summary="연습 일지 등록 및 Vlog 비디오 업로드",
)
async def create_practice_log(
    project_id: str,
    logged_date: str,
    description: Optional[str] = None,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_project_access(db, project_id, current_user)

    # Limit to video uploads
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="동영상 파일만 업로드할 수 있습니다.")

    # Save video locally in temp/uploads/vlogs
    PROJECT_ROOT = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    vlog_dir = os.path.join(PROJECT_ROOT, "temp", "uploads", "vlogs")
    os.makedirs(vlog_dir, exist_ok=True)

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    filename = f"vlog_{project_id}_{current_user.id}_{datetime.now().strftime('%Y%md_%H%M%S')}{ext}"
    file_path = os.path.join(vlog_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    video_url = f"/static/uploads/vlogs/{filename}"

    # Create database log entry
    log_entry = PracticeLog(
        project_id=project_id,
        user_id=current_user.id,
        video_url=video_url,
        description=description,
        logged_date=logged_date,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    # Reload with user details
    log_entry = (
        db.query(PracticeLog)
        .filter(PracticeLog.id == log_entry.id)
        .options(joinedload(PracticeLog.user))
        .first()
    )
    return log_entry


# ============= User Search / Invite Routes =============


@router.get("/search-users", response_model=List[UserResponse], summary="초대할 사용자 검색")
async def search_users(
    project_id: str,
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = check_project_access(db, project_id, current_user)

    # Exclude owner and existing members
    existing_user_ids = [project.user_id] if project.user_id else []
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    existing_user_ids.extend([m.user_id for m in members])

    # Find matching active users
    users = (
        db.query(User)
        .filter(
            User.id.notin_(existing_user_ids),
            User.is_active == True,  # noqa: E712
            (User.email.ilike(f"%{q}%")) | (User.nickname.ilike(f"%{q}%")),
        )
        .limit(10)
        .all()
    )
    return users
