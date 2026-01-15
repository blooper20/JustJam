from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from src.api.routes import projects

app = FastAPI(
    title="Band-Mate AI API",
    description="Band-Mate AI를 위한 백엔드 API (음원 분리 및 타브 생성)",
    version="0.1.0"
)

# 라우터 포함
app.include_router(projects.router, prefix="/projects", tags=["projects"])

# CORS 설정
origins = [
    "http://localhost:3000", # Next.js 기본 포트
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 스템 파일을 위한 정적 파일 서빙
# 프로젝트 루트의 'temp' 폴더를 서빙합니다
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
temp_dir = os.path.join(project_root, 'temp')
os.makedirs(temp_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=temp_dir), name="static")

@app.get("/")
def read_root():
    return {"message": "Band-Mate AI API가 실행 중입니다!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
