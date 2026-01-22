import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 테스트 환경 설정
os.environ["APP_ENV"] = "test"

# 프로젝트 루트를 path에 추가
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.api.database import Base, get_db
from src.api.main import app
from src.api.models import User

# 테스트용 SQLite DB 설정
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    # 테스트 시작 전 테이블 생성
    Base.metadata.create_all(bind=engine)
    yield
    # 테스트 종료 후 DB 삭제
    if os.path.exists("./test.db"):
        os.remove("./test.db")


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # 트랜잭션 내에서 모든 테스트가 실행되도록 설정
    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    del app.dependency_overrides[get_db]


@pytest.fixture
def test_user(db):
    user = User(
        email="test@example.com",
        nickname="TestUser",
        provider="google",
        provider_id="test_provider_id",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    from src.api.auth.jwt import create_access_token

    token_data = {"user_id": test_user.id, "email": test_user.email}
    access_token = create_access_token(token_data)
    return {"Authorization": f"Bearer {access_token}"}
