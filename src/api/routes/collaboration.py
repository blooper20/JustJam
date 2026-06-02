import os
import shutil
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
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
    ConfirmTimeRequest,
    PostOptionCreate,
    PostOptionResponse,
    PracticeLogResponse,
)
from src.api.schemas.user import UserResponse

router = APIRouter(tags=["Collaboration"])


from src.api.models import Team, TeamMember


def check_team_access(db: Session, team_id: int, current_user: User) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    is_owner = team.owner_id == current_user.id
    is_member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
        .first()
        is not None
    )
    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="이 팀에 접근할 권한이 없습니다.")

    return team


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
    "/teams/{team_id}/posts",
    response_model=List[CollaborationPostResponse],
    summary="협업 포스트 목록 조회",
)
async def list_posts(
    team_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_team_access(db, team_id, current_user)

    posts = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.team_id == team_id)
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


@router.post(
    "/teams/{team_id}/posts", response_model=CollaborationPostResponse, summary="협업 포스트 작성"
)
async def create_post(
    team_id: int,
    post_in: CollaborationPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_team_access(db, team_id, current_user)

    post = CollaborationPost(
        team_id=team_id,
        user_id=current_user.id,
        title=post_in.title,
        content=post_in.content or "",
        post_type=post_in.post_type,
        youtube_url=post_in.youtube_url,
    )
    db.add(post)
    db.flush()  # Obtain post.id

    if post_in.post_type == "vote" and post_in.options:
        for opt in post_in.options:
            option = PostOption(
                post_id=post.id, option_text=opt.option_text, youtube_url=opt.youtube_url
            )
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


@router.delete("/teams/{team_id}/posts/{post_id}", summary="협업 포스트 삭제")
async def delete_post(
    team_id: int,
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_team_access(db, team_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.team_id == team_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Only creator or team owner can delete
    team = db.query(Team).filter(Team.id == team_id).first()
    if post.user_id != current_user.id and team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")

    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}


# ============= Vote Option Routes =============


@router.post(
    "/teams/{team_id}/posts/{post_id}/options",
    response_model=PostOptionResponse,
    summary="투표 항목 추가",
)
async def add_vote_option(
    team_id: int,
    post_id: int,
    option_in: PostOptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_team_access(db, team_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.team_id == team_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.post_type != "vote":
        raise HTTPException(status_code=400, detail="This post is not a vote post")

    option = PostOption(
        post_id=post.id,
        option_text=option_in.option_text,
        youtube_url=option_in.youtube_url,
    )
    db.add(option)
    db.commit()
    db.refresh(option)

    option.votes_count = 0
    option.voted_user_ids = []
    return option


# ============= Comments Routes =============


@router.post(
    "/teams/{team_id}/posts/{post_id}/comments",
    response_model=CollaborationCommentResponse,
    summary="포스트 댓글 작성",
)
async def create_comment(
    team_id: int,
    post_id: int,
    comment_in: CollaborationCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_team_access(db, team_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.team_id == team_id)
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


@router.delete("/teams/{team_id}/posts/{post_id}/comments/{comment_id}", summary="포스트 댓글 삭제")
async def delete_comment(
    team_id: int,
    post_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_team_access(db, team_id, current_user)

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
    "/teams/{team_id}/posts/{post_id}/vote/{option_id}",
    response_model=CollaborationPostResponse,
    summary="포스트 투표 토글",
)
async def toggle_vote(
    team_id: int,
    post_id: int,
    option_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_team_access(db, team_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.team_id == team_id)
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
    "/teams/{team_id}/posts/{post_id}/availability/{schedule_time_id}",
    response_model=CollaborationPostResponse,
    summary="후보 일정 가능 여부 토글",
)
async def toggle_availability(
    team_id: int,
    post_id: int,
    schedule_time_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_team_access(db, team_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.team_id == team_id)
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


@router.post(
    "/teams/{team_id}/posts/{post_id}/confirm-time",
    response_model=CollaborationPostResponse,
    summary="일정 확정",
)
async def confirm_schedule_time(
    team_id: int,
    post_id: int,
    req: ConfirmTimeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = check_team_access(db, team_id, current_user)

    post = (
        db.query(CollaborationPost)
        .filter(CollaborationPost.id == post_id, CollaborationPost.team_id == team_id)
        .first()
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    is_team_owner = team.owner_id == current_user.id
    is_post_owner = post.user_id == current_user.id
    if not is_team_owner and not is_post_owner:
        raise HTTPException(status_code=403, detail="일정을 확정할 권한이 없습니다.")

    post.confirmed_time = req.confirmed_time
    db.commit()

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
    "/projects/{project_id}/practice-logs",
    response_model=List[PracticeLogResponse],
    summary="연습 일지 목록 조회",
)
async def list_practice_logs(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project or not project.team_id:
        raise HTTPException(status_code=404, detail="Project or Team not found")
    check_team_access(db, project.team_id, current_user)

    logs = (
        db.query(PracticeLog)
        .filter(PracticeLog.project_id == project_id)
        .options(joinedload(PracticeLog.user))
        .order_by(PracticeLog.logged_date.desc(), PracticeLog.created_at.desc())
        .all()
    )
    return logs


@router.post(
    "/projects/{project_id}/practice-logs",
    response_model=PracticeLogResponse,
    summary="연습 일지 등록 및 Vlog 비디오 업로드",
)
async def create_practice_log(
    project_id: str,
    logged_date: str,
    description: Optional[str] = None,
    start_time: float = Form(0.0),
    overlay_text: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project or not project.team_id:
        raise HTTPException(status_code=404, detail="Project or Team not found")
    check_team_access(db, project.team_id, current_user)

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
    if not ext:
        ext = ".mp4"

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_filename = f"raw_vlog_{project_id}_{current_user.id}_{timestamp}{ext}"
    temp_file_path = os.path.join(vlog_dir, temp_filename)

    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    processed_filename = f"vlog_{project_id}_{current_user.id}_{timestamp}.mp4"
    processed_file_path = os.path.join(vlog_dir, processed_filename)

    # ffmpeg processing command
    import subprocess

    cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        str(start_time),
        "-t",
        "5",
        "-i",
        temp_file_path,
    ]

    vf_filters = []
    if overlay_text:
        # Check if NanumGothic font exists
        font_path = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
        if not os.path.exists(font_path):
            font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        escaped_text = overlay_text.replace("'", "'\\''")
        vf_filters.append(
            f"drawtext=fontfile={font_path}:text='{escaped_text}':"
            "x=(w-text_w)/2:y=(h-text_h)/2:fontsize=36:fontcolor=white:"
            "box=1:boxcolor=black@0.5:boxborderw=10"
        )

    if vf_filters:
        cmd.extend(["-vf", ",".join(vf_filters)])

    cmd.extend(["-c:v", "libx264", "-c:a", "aac", processed_file_path])

    try:
        # Run ffmpeg
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception as e:
        from src.api.logging_config import logger

        logger.error(f"Video processing failed, using original file: {e}")
        if os.path.exists(temp_file_path):
            if os.path.exists(processed_file_path):
                os.remove(processed_file_path)
            shutil.copy(temp_file_path, processed_file_path)

    video_url = f"/static/uploads/vlogs/{processed_filename}"
    raw_video_url = f"/static/uploads/vlogs/{temp_filename}"

    # Create database log entry
    log_entry = PracticeLog(
        project_id=project_id,
        team_id=project.team_id,
        user_id=current_user.id,
        video_url=video_url,
        raw_video_url=raw_video_url,
        start_time=start_time,
        overlay_text=overlay_text,
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


@router.delete("/projects/{project_id}/practice-logs/{log_id}", summary="연습 일지 삭제")
async def delete_practice_log(
    project_id: str,
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project or not project.team_id:
        raise HTTPException(status_code=404, detail="Project or Team not found")
    check_team_access(db, project.team_id, current_user)

    log = (
        db.query(PracticeLog)
        .filter(PracticeLog.id == log_id, PracticeLog.project_id == project_id)
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Practice log not found")

    # 올린 유저만 삭제 가능
    if log.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="자신이 업로드한 연습 비디오만 삭제할 수 있습니다."
        )

    # Delete local video file if it exists
    PROJECT_ROOT = os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
    if log.video_url.startswith("/static/"):
        relative_path = log.video_url.replace("/static/", "")
        file_path = os.path.join(PROJECT_ROOT, "temp", relative_path)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                from src.api.logging_config import logger

                logger.error(f"Failed to delete video file {file_path}: {e}")

    if log.raw_video_url and log.raw_video_url.startswith("/static/"):
        relative_raw_path = log.raw_video_url.replace("/static/", "")
        raw_file_path = os.path.join(PROJECT_ROOT, "temp", relative_raw_path)
        if os.path.exists(raw_file_path):
            try:
                os.remove(raw_file_path)
            except Exception as e:
                from src.api.logging_config import logger

                logger.error(f"Failed to delete raw video file {raw_file_path}: {e}")

    db.delete(log)
    db.commit()
    return {"message": "Practice log deleted successfully"}


@router.put(
    "/projects/{project_id}/practice-logs/{log_id}",
    response_model=PracticeLogResponse,
    summary="연습 일지 및 비디오 수정",
)
async def update_practice_log(
    project_id: str,
    log_id: int,
    description: Optional[str] = Form(None),
    start_time: float = Form(0.0),
    overlay_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project or not project.team_id:
        raise HTTPException(status_code=404, detail="Project or Team not found")
    check_team_access(db, project.team_id, current_user)

    log = (
        db.query(PracticeLog)
        .filter(PracticeLog.id == log_id, PracticeLog.project_id == project_id)
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Practice log not found")

    if log.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="자신이 업로드한 연습 비디오만 수정할 수 있습니다."
        )

    log.description = description

    if log.raw_video_url:
        PROJECT_ROOT = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        relative_raw_path = log.raw_video_url.replace("/static/", "")
        raw_file_path = os.path.join(PROJECT_ROOT, "temp", relative_raw_path)

        if os.path.exists(raw_file_path):
            vlog_dir = os.path.dirname(raw_file_path)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            processed_filename = f"vlog_{project_id}_{current_user.id}_{timestamp}.mp4"
            processed_file_path = os.path.join(vlog_dir, processed_filename)

            import subprocess

            cmd = [
                "ffmpeg",
                "-y",
                "-ss",
                str(start_time),
                "-t",
                "5",
                "-i",
                raw_file_path,
            ]

            vf_filters = []
            if overlay_text:
                font_path = "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
                if not os.path.exists(font_path):
                    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
                escaped_text = overlay_text.replace("'", "'\\''")
                vf_filters.append(
                    f"drawtext=fontfile={font_path}:text='{escaped_text}':"
                    "x=(w-text_w)/2:y=(h-text_h)/2:fontsize=36:fontcolor=white:"
                    "box=1:boxcolor=black@0.5:boxborderw=10"
                )

            if vf_filters:
                cmd.extend(["-vf", ",".join(vf_filters)])

            cmd.extend(["-c:v", "libx264", "-c:a", "aac", processed_file_path])

            try:
                subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

                if log.video_url.startswith("/static/"):
                    old_relative_path = log.video_url.replace("/static/", "")
                    old_file_path = os.path.join(PROJECT_ROOT, "temp", old_relative_path)
                    if os.path.exists(old_file_path):
                        try:
                            os.remove(old_file_path)
                        except Exception as e:
                            from src.api.logging_config import logger

                            logger.error(f"Failed to delete old video {old_file_path}: {e}")

                log.video_url = f"/static/uploads/vlogs/{processed_filename}"
                log.start_time = start_time
                log.overlay_text = overlay_text

            except Exception as e:
                from src.api.logging_config import logger

                logger.error(f"Re-processing video failed during update: {e}")
                if os.path.exists(raw_file_path):
                    if os.path.exists(processed_file_path):
                        os.remove(processed_file_path)
                    import shutil

                    shutil.copy(raw_file_path, processed_file_path)

                    if log.video_url.startswith("/static/"):
                        old_relative_path = log.video_url.replace("/static/", "")
                        old_file_path = os.path.join(PROJECT_ROOT, "temp", old_relative_path)
                        if os.path.exists(old_file_path) and old_file_path != processed_file_path:
                            try:
                                os.remove(old_file_path)
                            except Exception:
                                pass

                    log.video_url = f"/static/uploads/vlogs/{processed_filename}"
                    log.start_time = start_time
                    log.overlay_text = overlay_text
        else:
            log.start_time = start_time
            log.overlay_text = overlay_text
    else:
        log.start_time = start_time
        log.overlay_text = overlay_text

    db.commit()
    db.refresh(log)

    log = (
        db.query(PracticeLog)
        .filter(PracticeLog.id == log.id)
        .options(joinedload(PracticeLog.user))
        .first()
    )
    return log


# ============= User Search / Invite Routes =============


@router.get(
    "/projects/{project_id}/search-users",
    response_model=List[UserResponse],
    summary="초대할 사용자 검색",
)
async def search_users(
    project_id: str,
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project or not project.team_id:
        raise HTTPException(status_code=404, detail="Project or Team not found")
    check_team_access(db, project.team_id, current_user)

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
