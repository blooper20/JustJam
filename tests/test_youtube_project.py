import os
from unittest.mock import patch

from fastapi import status

from src.api.services.project_service import UPLOAD_DIR


def test_create_project_youtube_success(client, auth_headers):
    """유튜브 링크로 프로젝트 생성 성공 케이스"""
    fake_title = "Test YouTube Track"

    # download_youtube_audio를 mocking
    with patch("src.api.services.project_service.download_youtube_audio") as mock_download:
        mock_download.return_value = fake_title

        # 실제 mock_download가 호출된 시점에 project_id를 알아서 그에 매칭되는 파일(project_id.mp3)을 생성하게 함.
        def fake_download(youtube_url, upload_dir, project_id):
            file_path = os.path.join(upload_dir, f"{project_id}.mp3")
            with open(file_path, "wb") as f:
                f.write(b"fake audio mp3 data")
            return fake_title

        mock_download.side_effect = fake_download

        response = client.post(
            "/projects/",
            data={"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == fake_title
        assert data["status"] == "pending"
        assert "id" in data

        # 파일이 잘 복사/생성되었는지 확인
        project_id = data["id"]
        expected_path = os.path.join(UPLOAD_DIR, f"{project_id}.mp3")
        assert os.path.exists(expected_path)

        # clean up
        if os.path.exists(expected_path):
            os.remove(expected_path)
        thumb_path = os.path.join(UPLOAD_DIR, f"thumb_{project_id}.png")
        if os.path.exists(thumb_path):
            os.remove(thumb_path)


def test_create_project_validation_failure(client, auth_headers):
    """파일과 유튜브 링크 둘 다 안 넘겼을 때 400 에러"""
    response = client.post("/projects/", headers=auth_headers)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
