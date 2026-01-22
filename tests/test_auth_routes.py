import pytest

from src.api.models import User


def test_login_new_user(client, db):
    """신규 사용자 로그인 시 계정 생성 및 토큰 발급 확인"""
    login_data = {
        "email": "newuser@example.com",
        "nickname": "NewUser",
        "provider": "google",
        "provider_id": "google123",
        "profile_image": "http://example.com/image.png",
    }

    response = client.post("/auth/login", json=login_data)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["nickname"] == "NewUser"

    # DB에 생성되었는지 확인
    user = db.query(User).filter(User.provider_id == "google123").first()
    assert user is not None
    assert user.email == "newuser@example.com"


def test_login_existing_user(client, db):
    """기존 사용자 로그인 시 정보 업데이트 및 토큰 발급 확인"""
    # 먼저 사용자 생성
    user = User(
        email="olduser@example.com", nickname="OldUser", provider="kakao", provider_id="kakao123"
    )
    db.add(user)
    db.commit()

    login_data = {
        "email": "olduser@example.com",
        "nickname": "UpdatedNickname",
        "provider": "kakao",
        "provider_id": "kakao123",
        "profile_image": "http://example.com/new.png",
    }

    response = client.post("/auth/login", json=login_data)

    assert response.status_code == 200
    data = response.json()
    assert data["user"]["nickname"] == "UpdatedNickname"

    # DB 업데이트 확인
    db.refresh(user)
    assert user.nickname == "UpdatedNickname"
    assert user.profile_image == "http://example.com/new.png"


def test_refresh_token(client, db):
    """Refresh Token으로 Access Token 갱신 확인"""
    # 로그인 먼저 해서 refresh_token 획득
    login_data = {
        "email": "refresh@example.com",
        "nickname": "RefreshTest",
        "provider": "google",
        "provider_id": "google_refresh",
    }
    login_resp = client.post("/auth/login", json=login_data)
    refresh_token = login_resp.json()["refresh_token"]

    # 토큰 갱신 요청
    refresh_data = {"refresh_token": refresh_token}
    response = client.post("/auth/refresh", json=refresh_data)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "refresh@example.com"


def test_refresh_token_invalid(client):
    """잘못된 Refresh Token으로 요청 시 에러 확인"""
    refresh_data = {"refresh_token": "invalid_token_here"}
    response = client.post("/auth/refresh", json=refresh_data)

    assert response.status_code == 401
    assert "detail" in response.json()


def test_logout(client, auth_headers):
    """로그아웃 성공 확인"""
    response = client.post("/auth/logout", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["message"] == "로그아웃되었습니다"


def test_logout_unauthorized(client):
    """인증 없이 로그아웃 시 에러 확인"""
    response = client.post("/auth/logout")
    assert response.status_code == 401
