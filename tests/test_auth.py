from datetime import timedelta

import pytest
from jose import jwt

from src.api.auth.jwt import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_token,
)


def test_create_access_token():
    """Access Token 생성이 정상적으로 이루어지는지 확인"""
    data = {"sub": "test_user", "id": 123}
    token = create_access_token(data)

    assert isinstance(token, str)
    assert len(token) > 0

    # 디코딩하여 내용 확인
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "test_user"
    assert payload["id"] == 123
    assert payload["type"] == "access"
    assert "exp" in payload
    assert "iat" in payload


def test_create_refresh_token():
    """Refresh Token 생성이 정상적으로 이루어지는지 확인"""
    data = {"sub": "test_user"}
    token = create_refresh_token(data)

    assert isinstance(token, str)

    # 디코딩하여 내용 확인
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "test_user"
    assert payload["type"] == "refresh"
    assert "exp" in payload


def test_verify_token_success():
    """정상적인 토근 검증 확인"""
    data = {"sub": "test_user", "type": "access"}
    token = create_access_token(data)

    payload = verify_token(token, token_type="access")
    assert payload is not None
    assert payload["sub"] == "test_user"


def test_verify_token_invalid_type():
    """토큰 타입이 맞지 않을 경우 검증 실패 확인"""
    data = {"sub": "test_user"}
    token = create_access_token(data)  # type: access

    # refresh 타입으로 검증 요청
    payload = verify_token(token, token_type="refresh")
    assert payload is None


def test_verify_token_invalid_secret():
    """잘못된 시크릿 키로 서명된 토큰 검증 실패 확인"""
    data = {"sub": "test_user", "type": "access"}
    wrong_secret = "wrong-secret-key-at-least-32-chars-long-!!!"
    token = jwt.encode(data, wrong_secret, algorithm=ALGORITHM)

    payload = verify_token(token)
    assert payload is None


def test_decode_token_no_verify():
    """검증 없이 디코딩이 정상적으로 이루어지는지 확인"""
    data = {"sub": "test_user", "info": "secret"}
    token = create_access_token(data)

    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "test_user"
    assert payload["info"] == "secret"


def test_token_expiration():
    """만료된 토큰 검증 실패 확인"""
    # 1초 전 만료되도록 설정
    data = {"sub": "test_user", "type": "access"}
    expires_delta = timedelta(seconds=-1)
    token = create_access_token(data, expires_delta=expires_delta)

    payload = verify_token(token)
    assert payload is None
