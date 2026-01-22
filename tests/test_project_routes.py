import os
import uuid

import pytest
from fastapi import status


def test_create_project(client, auth_headers):
    """프로젝트 생성 테스트"""
    # 임시 오디오 파일 생성
    with open("test_audio.mp3", "wb") as f:
        f.write(b"fake audio data")

    with open("test_audio.mp3", "rb") as f:
        response = client.post(
            "/projects/", files={"file": ("test_audio.mp3", f, "audio/mpeg")}, headers=auth_headers
        )

    # 임시 파일 삭제
    if os.path.exists("test_audio.mp3"):
        os.remove("test_audio.mp3")

    assert response.status_code == status.HTTP_200_OK
    data = response.data if hasattr(response, "data") else response.json()
    assert data["name"] == "test_audio.mp3"
    assert data["status"] == "pending"
    assert "id" in data


def test_list_projects(client, auth_headers, test_user, db):
    """프로젝트 목록 조회 테스트"""
    from src.api.models import ProjectModel

    # 테스트용 프로젝트 추가
    project = ProjectModel(
        id=str(uuid.uuid4()),
        name="Saved Project",
        original_filename="saved.mp3",
        user_id=test_user.id,
        status="completed",
    )
    db.add(project)
    db.commit()

    response = client.get("/projects/", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) >= 1
    assert any(p["name"] == "Saved Project" for p in data)


def test_get_project(client, auth_headers, test_user, db):
    """특정 프로젝트 상세 조회 테스트"""
    from src.api.models import ProjectModel

    project_id = str(uuid.uuid4())
    project = ProjectModel(
        id=project_id, name="Target Project", original_filename="target.mp3", user_id=test_user.id
    )
    db.add(project)
    db.commit()

    response = client.get(f"/projects/{project_id}", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "Target Project"


def test_update_project(client, auth_headers, test_user, db):
    """프로젝트 정보 수정 테스트"""
    from src.api.models import ProjectModel

    project_id = str(uuid.uuid4())
    project = ProjectModel(
        id=project_id, name="Old Name", original_filename="old.mp3", user_id=test_user.id
    )
    db.add(project)
    db.commit()

    response = client.patch(
        f"/projects/{project_id}", json={"name": "New Name"}, headers=auth_headers
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "New Name"


def test_clone_project(client, auth_headers, test_user, db):
    """프로젝트 복제 테스트"""
    from src.api.models import ProjectModel

    project_id = str(uuid.uuid4())
    # UPLOAD_DIR 환경변수나 기본값 맞춰야함. tests/conftest.py 에서 temp 디렉토리 설정 필요할 수도 있음.
    # 여기서는 DB 레벨 복제 위주로 확인
    project = ProjectModel(
        id=project_id,
        name="Source Project",
        original_filename="source.mp3",
        user_id=test_user.id,
        status="completed",
        bpm=120,
    )
    db.add(project)
    db.commit()

    # UPLOAD_DIR에 파일이 있어야 에러 안남
    upload_dir = os.path.join(os.getcwd(), "temp", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    with open(os.path.join(upload_dir, "source.mp3"), "wb") as f:
        f.write(b"source data")

    response = client.post(f"/projects/{project_id}/clone", headers=auth_headers)

    # cleanup
    if os.path.exists(os.path.join(upload_dir, "source.mp3")):
        os.remove(os.path.join(upload_dir, "source.mp3"))

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Source Project (Copy)"
    assert data["bpm"] == 120
    assert data["id"] != project_id


def test_delete_project(client, auth_headers, test_user, db):
    """프로젝트 삭제 테스트"""
    from src.api.models import ProjectModel

    project_id = str(uuid.uuid4())
    project = ProjectModel(
        id=project_id, name="To Delete", original_filename="delete.mp3", user_id=test_user.id
    )
    db.add(project)
    db.commit()

    response = client.delete(f"/projects/{project_id}", headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK

    # DB에서 사라졌는지 확인
    deleted_project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    assert deleted_project is None
