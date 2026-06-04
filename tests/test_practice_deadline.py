import os
import uuid
from datetime import datetime, timedelta

from fastapi import status

from src.api.models import ProjectModel, Team, TeamMember


def test_update_deadline_permission(client, auth_headers, test_user, db):
    """매니저/부매니저 권한에 따른 마감일 설정 제한 테스트"""
    # 1. 테스트용 팀 및 프로젝트 생성 (test_user가 소유자)
    team = Team(name="Test Team", owner_id=test_user.id)
    db.add(team)
    db.commit()

    project_id = str(uuid.uuid4())
    project = ProjectModel(
        id=project_id,
        name="Deadline Test Project",
        original_filename="test.mp3",
        user_id=test_user.id,
        team_id=team.id,
        status="completed",
    )
    db.add(project)
    db.commit()

    # 소유자가 마감일을 설정하는 경우 -> 성공 (200 OK)
    response = client.patch(
        f"/projects/{project_id}", json={"practice_deadline": "2026-12-31"}, headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["practice_deadline"] == "2026-12-31"

    # 2. 다른 유저 생성 (비매니저/뷰어)
    from src.api.models import User

    other_user = User(
        email="viewer@example.com",
        provider="google",
        provider_id="viewer_oauth_id",
        nickname="Viewer User",
        is_active=True,
    )
    db.add(other_user)
    db.commit()

    # 타 유저 인증 헤더 생성
    from src.api.auth.jwt import create_access_token

    token = create_access_token(data={"user_id": other_user.id})
    other_headers = {"Authorization": f"Bearer {token}"}

    # 팀 멤버로 등록하되 권한은 viewer로 설정
    team_member = TeamMember(team_id=team.id, user_id=other_user.id, role="viewer")
    db.add(team_member)
    db.commit()

    # 비매니저(viewer)가 마감일을 수정하려 하는 경우 -> 실패 (403 Forbidden)
    response = client.patch(
        f"/projects/{project_id}", json={"practice_deadline": "2026-06-01"}, headers=other_headers
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN

    # 3. 부매니저(editor)로 등급 업그레이드
    team_member.role = "editor"
    db.commit()

    # 부매니저(editor)가 마감일을 수정하려 하는 경우 -> 성공 (200 OK)
    response = client.patch(
        f"/projects/{project_id}", json={"practice_deadline": "2026-07-01"}, headers=other_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["practice_deadline"] == "2026-07-01"


def test_practice_upload_deadline_block(client, auth_headers, test_user, db):
    """마감일 도래 여부에 따른 연습 영상 업로드 가능 여부 테스트"""
    # 테스트용 팀 및 프로젝트 생성
    team = Team(name="Upload Team", owner_id=test_user.id)
    db.add(team)
    db.commit()

    project_id = str(uuid.uuid4())
    project = ProjectModel(
        id=project_id,
        name="Upload Test Project",
        original_filename="test.mp3",
        user_id=test_user.id,
        team_id=team.id,
        status="completed",
    )
    db.add(project)
    db.commit()

    # 임시 비디오 파일 생성
    video_filename = "test_vlog.mp4"
    with open(video_filename, "wb") as f:
        f.write(b"fake video mp4 data")

    # 1. 마감일을 어제(이미 경과됨)로 지정
    yesterday = (datetime.utcnow() + timedelta(hours=9) - timedelta(days=1)).strftime("%Y-%m-%d")
    project.practice_deadline = yesterday
    db.commit()

    # 경과 후 업로드 시도 -> 실패 (400 Bad Request)
    with open(video_filename, "rb") as f:
        response = client.post(
            f"/projects/{project_id}/practice-logs?logged_date={yesterday}",
            files={"file": (video_filename, f, "video/mp4")},
            headers=auth_headers,
        )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "제출 마감일이 지났습니다" in response.json()["detail"]

    # 2. 마감일을 내일(아직 지나지 않음)로 변경
    tomorrow = (datetime.utcnow() + timedelta(hours=9) + timedelta(days=1)).strftime("%Y-%m-%d")
    project.practice_deadline = tomorrow
    db.commit()

    # 경과 전 업로드 시도 -> 성공 (200 OK)
    with open(video_filename, "rb") as f:
        response = client.post(
            f"/projects/{project_id}/practice-logs?logged_date={tomorrow}",
            files={"file": (video_filename, f, "video/mp4")},
            data={"start_time": 0.0},
            headers=auth_headers,
        )
    # mock subprocess 실행 문제로 200이 안 날 수도 있으나, 업로드 로직 자체(마감일 통과)는 에러가 없으므로
    # 데이터베이스 로그 레코드가 성공적으로 생성되거나 200 OK로 반환되는지 확인
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["logged_date"] == tomorrow

    # 임시 파일 정리
    if os.path.exists(video_filename):
        os.remove(video_filename)
