from fastapi.testclient import TestClient

from src.api.main import app


def test_cors_allowed_origins():
    client = TestClient(app)

    # 1. 테스트: ALLOWED_ORIGINS에 등록된 origin
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
        "https://justjam.vercel.app",
    ]
    for origin in allowed_origins:
        response = client.get("/health", headers={"Origin": origin})
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin


def test_cors_vercel_subdomains():
    client = TestClient(app)

    # 2. 테스트: Vercel 동적 서브도메인 (정규식 매칭 대상)
    vercel_subdomains = [
        "https://just-jam.vercel.app",
        "https://project-git-main-dwaevs-projects.vercel.app",
        "https://test-subdomain.vercel.app",
        "https://dwaevs-projects.vercel.app",
    ]
    for origin in vercel_subdomains:
        response = client.get("/health", headers={"Origin": origin})
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin


def test_cors_disallowed_origins():
    client = TestClient(app)

    # 3. 테스트: 허용되지 않아야 하는 origin (보안 취약점 공격 형태 포함)
    disallowed_origins = [
        "https://vercel.app.attacker.com",
        "https://attacker-vercel.app.com",
        "http://attacker.com",
        "https://justjam.vercel.app.foo.com",
    ]
    for origin in disallowed_origins:
        response = client.get("/health", headers={"Origin": origin})
        assert response.status_code == 200
        assert "access-control-allow-origin" not in response.headers
