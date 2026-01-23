import os
from datetime import datetime

import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.backends.redis import RedisBackend
from prometheus_fastapi_instrumentator import Instrumentator

from src.api.database import Base, engine
from src.api.routes import auth, projects, users

Base.metadata.create_all(bind=engine)

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from src.api.limiter import limiter
from src.api.logging_config import logger, setup_logging

# 로깅 설정 초기화
setup_logging()

app = FastAPI(
    title="JustJam API", description="JustJam - 음악 협업 및 타브 생성 플랫폼 API", version="0.2.1"
)

# Gzip 압축 미들웨어 추가 (성능 최적화)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.on_event("startup")
async def startup():
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            r = redis.from_url(redis_url, encoding="utf8", decode_responses=True)
            FastAPICache.init(RedisBackend(r), prefix="fastapi-cache")
            logger.info("FastAPICache initialized with Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis, falling back to InMemory: {e}")
            FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
    else:
        FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
        logger.info("FastAPICache initialized with InMemoryBackend")


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Prometheus 모니터링 초기화 (테스트 환경 제외)
if os.getenv("APP_ENV") != "test":
    Instrumentator().instrument(app).expose(app)
    logger.info("Prometheus Instrumentator initialized")

from src.api.exceptions import JustJamException


@app.exception_handler(JustJamException)
async def justjam_exception_handler(request: Request, exc: JustJamException):
    error_code = exc.__class__.__name__.replace("Error", "").upper()
    if error_code == "JUSTJAMEXCEPTION":
        error_code = "INTERNAL_ERROR"
        
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": f"https://justjam.ai/errors/{exc.__class__.__name__.lower()}",
            "title": exc.__class__.__name__,
            "status": exc.status_code,
            "detail": exc.detail,
            "instance": str(request.url),
            "code": error_code,
            "extensions": {
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": "https://justjam.ai/errors/http-exception",
            "title": "HTTP Exception",
            "status": exc.status_code,
            "detail": exc.detail,
            "instance": str(request.url),
            "code": f"HTTP_{exc.status_code}",
            "extensions": {
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        },
    )


# 라우터 포함
app.include_router(auth.router)  # /auth
app.include_router(users.router)  # /users
app.include_router(projects.router, prefix="/projects", tags=["projects"])

# CORS 설정
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:8000")
origins = [origin.strip() for origin in allowed_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# HTTPS 리다이렉트 미들웨어 (프로덕션 환경 전용)
@app.middleware("http")
async def enforce_https_redirect(request: Request, call_next):
    env = os.getenv("APP_ENV", "development")
    if env == "production":
        # 클라우드 공급자(Heroku, Fly.io 등)는 보통 X-Forwarded-Proto 헤더를 사용함
        if request.headers.get("x-forwarded-proto") != "https":
            url = request.url.replace(scheme="https")
            return RedirectResponse(url, status_code=status.HTTP_301_MOVED_PERMANENTLY)
    return await call_next(request)


@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response


# 스템 파일을 위한 정적 파일 서빙
class CacheStaticFiles(StaticFiles):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
temp_dir = os.path.join(project_root, "temp")
os.makedirs(temp_dir, exist_ok=True)

app.mount("/static", CacheStaticFiles(directory=temp_dir), name="static")


@app.get("/")
def read_root():
    return {"message": "Band-Mate AI API가 실행 중입니다!"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
