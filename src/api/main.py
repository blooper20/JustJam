import os
from datetime import datetime

import redis.asyncio as redis
import sentry_sdk
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.backends.redis import RedisBackend
from prometheus_fastapi_instrumentator import Instrumentator
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from src.api.database import Base, engine
from src.api.routes import auth, collaboration, projects, teams, users

# Sentry 초기화
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

Base.metadata.create_all(bind=engine)
from src.api.database import check_and_upgrade_schema

check_and_upgrade_schema(engine)

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
    # 500 내외의 심각한 오류만 Sentry로 전송
    if exc.status_code >= 500:
        sentry_sdk.capture_exception(exc)

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
            "extensions": {"timestamp": datetime.utcnow().isoformat() + "Z"},
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code >= 500:
        sentry_sdk.capture_exception(exc)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": "https://justjam.ai/errors/http-exception",
            "title": "HTTP Exception",
            "status": exc.status_code,
            "detail": exc.detail,
            "instance": str(request.url),
            "code": f"HTTP_{exc.status_code}",
            "extensions": {"timestamp": datetime.utcnow().isoformat() + "Z"},
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    error_messages = []
    for err in errors:
        loc = " -> ".join(str(path_item) for path_item in err.get("loc", []))
        msg = err.get("msg", "Unknown error")
        error_messages.append(f"{loc}: {msg}")

    clean_message = ", ".join(error_messages)

    return JSONResponse(
        status_code=422,
        content={
            "type": "https://justjam.ai/errors/validation-error",
            "title": "Validation Error",
            "status": 422,
            "detail": clean_message,
            "instance": str(request.url),
            "code": "VALIDATION_ERROR",
            "extensions": {"timestamp": datetime.utcnow().isoformat() + "Z"},
        },
    )


# 라우터 포함
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(teams.router, prefix="/api/v1/teams", tags=["teams"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(collaboration.router, prefix="/api/v1", tags=["collaboration"])

# CORS 설정
allowed_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://localhost:8000,https://justjam.vercel.app",
)
origins = [origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()]

# Vercel 배포 시 동적 서브도메인(예: *.vercel.app, *-dwaevs-projects.vercel.app)을 지원하기 위한 정규식
# 보안 취약점(예: vercel.app.attacker.com)을 방지하기 위해 $ 앵커를 사용하여 도메인 끝을 엄격하게 제한
allow_origin_regex = r"^https://([a-zA-Z0-9-]+\.)*(vercel\.app|dwaevs-projects\.vercel\.app)$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from src.api.i18n import set_locale


@app.middleware("http")
async def set_request_locale(request: Request, call_next):
    accept_language = request.headers.get("Accept-Language", "ko")
    locale = "en" if "en" in accept_language.lower() else "ko"
    set_locale(locale)
    return await call_next(request)


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


# 스템 파일을 위한 정적 파일 서빙 (Range Request 지원으로 오디오 스트리밍 최적화)
class RangeStaticFiles(StaticFiles):
    """HTTP Range Request를 지원하는 정적 파일 서버.
    브라우저가 오디오 파일을 처음부터 끝까지 다운로드하지 않고
    필요한 구간만 스트리밍할 수 있도록 한다.
    """

    AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".webm", ".opus", ".flac", ".aac", ".m4a"}

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)

        ext = os.path.splitext(path)[1].lower()
        if ext in self.AUDIO_EXTENSIONS:
            # 오디오 파일: 브라우저가 범위 요청(Range)으로 스트리밍할 수 있도록 허용
            response.headers["Accept-Ranges"] = "bytes"
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "Range"
            response.headers["Access-Control-Expose-Headers"] = "Content-Range, Accept-Ranges"
        else:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"

        return response


project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
temp_dir = os.path.join(project_root, "temp")
os.makedirs(temp_dir, exist_ok=True)

app.mount("/static", RangeStaticFiles(directory=temp_dir), name="static")


@app.get("/")
def read_root():
    return {"message": "Band-Mate AI API가 실행 중입니다!"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
