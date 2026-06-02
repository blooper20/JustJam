from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.api.database import get_db
from src.api.dependencies import get_current_user
from src.api.models import Team, TeamMember, User
from src.api.schemas.team import (
    TeamCreate,
    TeamMemberInstrumentUpdate,
    TeamMemberResponse,
    TeamResponse,
)
from src.api.schemas.user import UserResponse

router = APIRouter()


@router.get("/", response_model=List[TeamResponse])
async def list_teams(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # User's owned teams and teams they are members of
    owned_teams = db.query(Team).filter(Team.owner_id == current_user.id).all()
    member_teams = (
        db.query(Team).join(TeamMember).filter(TeamMember.user_id == current_user.id).all()
    )

    # Merge and deduplicate
    all_teams = {t.id: t for t in owned_teams + member_teams}.values()

    result = []
    for t in all_teams:
        # Ensure owner is in TeamMember table (Self-Healing)
        owner_member = (
            db.query(TeamMember)
            .filter(TeamMember.team_id == t.id, TeamMember.user_id == t.owner_id)
            .first()
        )
        if not owner_member:
            owner_member = TeamMember(team_id=t.id, user_id=t.owner_id, role="owner")
            db.add(owner_member)
            db.commit()
            db.refresh(t)

        t_dict = t.__dict__.copy()
        t_dict["is_owner"] = t.owner_id == current_user.id
        result.append(t_dict)

    return result


@router.post("/", response_model=TeamResponse)
async def create_team(
    team: TeamCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    db_team = Team(name=team.name, owner_id=current_user.id)
    db.add(db_team)
    db.flush()

    # Add owner as first member with owner role
    owner_member = TeamMember(team_id=db_team.id, user_id=current_user.id, role="owner")
    db.add(owner_member)
    db.commit()
    db.refresh(db_team)

    db_team_dict = db_team.__dict__.copy()
    db_team_dict["is_owner"] = True
    return db_team_dict


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
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
        raise HTTPException(status_code=403, detail="Not authorized to access this team")

    team_dict = team.__dict__.copy()
    team_dict["is_owner"] = is_owner
    return team_dict


@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    team_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Ensure owner is in TeamMember table (Self-Healing)
    owner_member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == team.owner_id)
        .first()
    )
    if not owner_member:
        owner_member = TeamMember(team_id=team_id, user_id=team.owner_id, role="owner")
        db.add(owner_member)
        db.commit()
        db.refresh(owner_member)

    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
    result = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        result.append(
            {
                "id": m.id,
                "team_id": m.team_id,
                "user_id": m.user_id,
                "role": m.role,
                "instrument": m.instrument,
                "created_at": m.created_at,
                "email": user.email if user else None,
                "nickname": user.nickname if user else None,
            }
        )
    return result


@router.patch("/{team_id}/members/{user_id}/instrument", response_model=TeamMemberResponse)
async def update_member_instrument(
    team_id: int,
    user_id: int,
    update_data: TeamMemberInstrumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only team owner can change instruments")

    member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.instrument = update_data.instrument
    db.commit()
    db.refresh(member)

    user = db.query(User).filter(User.id == member.user_id).first()
    return {
        "id": member.id,
        "team_id": member.team_id,
        "user_id": member.user_id,
        "role": member.role,
        "instrument": member.instrument,
        "created_at": member.created_at,
        "email": user.email if user else None,
        "nickname": user.nickname if user else None,
    }


@router.post("/{team_id}/share", response_model=TeamMemberResponse)
async def invite_team_member(
    team_id: int,
    email: str,
    role: str = "viewer",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only team owner can invite members")

    invitee = db.query(User).filter(User.email == email).first()
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found with that email")

    existing = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == invitee.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this team")

    member = TeamMember(team_id=team_id, user_id=invitee.id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)

    return {
        "id": member.id,
        "team_id": member.team_id,
        "user_id": member.user_id,
        "role": member.role,
        "instrument": member.instrument,
        "created_at": member.created_at,
        "email": invitee.email,
        "nickname": invitee.nickname,
    }


@router.get("/{team_id}/search-users", response_model=List[UserResponse], summary="초대할 사용자 검색")
async def search_team_users(
    team_id: int,
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only team owner can invite members")

    # Exclude existing members
    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
    existing_user_ids = [m.user_id for m in members]

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
