# JustJam 개선사항 및 로드맵
**날짜**: 2026-01-21
**목표**: 프로젝트 종합 검토 후 수정/보완점, 개선사항, 향후 계획 정리

---

## 0. 최근 완료 사항 (2026-01-22)

### 0.1 대시보드 및 리소스 최적화
- [x] **통계 로직 정밀화**: '보유 중' vs '생성 가능' 상태를 정확히 구분하도록 백엔드 최적화 (`joinedload` 적용)
- [x] **온디맨드 로딩 도입**: 페이지 진입 시 음원/악보를 자동으로 로드하지 않고 버튼 클릭 시에만 로드하도록 개선 (서버 부하 및 트래픽 절감)
- [x] **사용자 친화적 용어 변경**: 'DB 보관' 등의 기술 용어를 **'보관함에 보관'**으로 변경하여 사용자 이해도 향상
- [x] **베이스(4현) 타브 에러 해결**: 4현 악기 분석 시 발생하던 `IndexError` 수정 및 현별 동적 헤더 적용
- [x] **데이터 동기화 강화**: 프로젝트 상세 페이지에서 각 파트별(Vocal, Bass, Guitar 등) 생성 여부를 파악하여 UI 버튼 상태를 정밀 제어

---

## 1. 현재 프로젝트 상태 요약

### 1.1 완성도 평가

| 영역 | 완성도 | 상태 |
|--------------|------|
| 백엔드 핵심 기능 | 95% | ✅ 완성 |
| 프론트엔드 UI | 95% | ✅ 완성 |
| 인증 시스템 | 100% | ✅ 완성 |
| 데이터베이스 | 100% | ✅ 완성 |
| 음원 처리 | 100% | ✅ 완성 |
| 악보/타브 생성 | 100% | ✅ 완성 |
| 테스트 코드 | 20% | ❌ 부족 |
| 배포 준비 | 60% | 🟡 진행 중 |
| **전체** | **80%** | **🟢 MVP 완성** |

### 1.2 완료된 주요 기능
- ✅ Demucs 음원 분리 (6가지 스템: Vocals, Drums, Bass, Guitar, Piano, Other)
- ✅ Basic Pitch 기반 음성 인식
- ✅ 타브/악보 생성 (MusicXML, ASCII Tab)
- ✅ 멀티트랙 플레이어 (WaveSurfer.js)
- ✅ 메트로놈 기능 (BPM 자동 감지)
- ✅ NextAuth.js 소셜 로그인 (Google, Kakao)
- ✅ JWT 기반 인증 (Access + Refresh Token)
- ✅ 사용자별 프로젝트 관리
- ✅ Rate Limiting
- ✅ 리소스 온디맨드 로딩 최적화 (믹서/악보/타브)
- ✅ 베이스(4현) 타브 인식 및 에러 수정
- ✅ 보관함 기반 자산 관리 UI 명확화

---

## 2. 수정 및 보완 필요 사항

### 2.1 🔴 긴급 - 테스트 코드 작성

**현황**: 기본 테스트 파일 3개만 존재 (대부분 미완성)

**필요한 테스트 목록**:

#### 백엔드 단위 테스트
```
tests/
├── unit/
│   ├── test_jwt.py              # JWT 토큰 생성/검증
│   ├── test_audio_processor.py  # 음원 분리 로직
│   ├── test_transcriber.py      # 음성 인식 로직
│   ├── test_tab_generator.py    # 타브 생성 로직 (기존 확장)
│   └── test_score_generator.py  # 악보 생성 로직
├── integration/
│   ├── test_auth_routes.py      # 인증 API 통합 테스트
│   ├── test_project_routes.py   # 프로젝트 API 통합 테스트
│   └── test_user_routes.py      # 사용자 API 통합 테스트
└── e2e/
    └── test_full_workflow.py    # 전체 워크플로우 E2E
```

#### 프론트엔드 테스트
```
client/
├── __tests__/
│   ├── components/
│   │   ├── MultiTrackPlayer.test.tsx
│   │   ├── ScoreViewer.test.tsx
│   │   └── TabViewer.test.tsx
│   ├── pages/
│   │   ├── Login.test.tsx
│   │   └── Dashboard.test.tsx
│   └── e2e/
│       └── auth-flow.spec.ts    # Playwright E2E
```

**작업 체크리스트**:
- [ ] pytest 설정 완료 (conftest.py, fixtures)
- [ ] JWT 단위 테스트 작성
- [ ] 인증 API 통합 테스트 작성
- [ ] 프로젝트 CRUD 테스트 작성
- [ ] Jest + React Testing Library 설정
- [ ] 핵심 컴포넌트 테스트 작성
- [ ] Playwright E2E 테스트 설정

---

### 2.2 🔴 긴급 - 프로덕션 보안 강화

**현재 문제점**:
1. JWT Secret Key가 기본값 사용 중
2. 토큰 블랙리스트 미구현 (현재 클라이언트 측 처리만)
3. HTTPS 미설정

**수정 필요 항목**:

```python
# src/api/auth/jwt.py - 현재 문제
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")  # ⚠️ 기본값 위험

# 개선안
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY must be set in production")
```

**작업 체크리스트**:
- [ ] JWT Secret Key 검증 로직 추가
- [ ] 프로덕션 환경에서 기본값 사용 시 에러 발생
- [ ] Redis 기반 토큰 블랙리스트 구현 (선택사항)
- [ ] HTTPS 리다이렉트 미들웨어 추가
- [ ] 환경별 CORS 설정 분리

---

### 2.3 🟡 중간 - 에러 핸들링 개선

**현재 문제점**:
- 일부 엔드포인트에서 상세한 에러 메시지 부족
- 전역 예외 처리 미흡

**개선안**:

```python
# src/api/exceptions.py (새로 생성)
from fastapi import HTTPException, status

class JustJamException(Exception):
    """Base exception for JustJam"""
    pass

class AudioProcessingError(JustJamException):
    """음원 처리 중 에러"""
    pass

class TranscriptionError(JustJamException):
    """음성 인식 중 에러"""
    pass

class InsufficientQuotaError(JustJamException):
    """사용량 한도 초과"""
    pass
```

**작업 체크리스트**:
- [ ] 커스텀 예외 클래스 정의
- [ ] 전역 예외 핸들러 추가 (`@app.exception_handler`)
- [ ] 에러 응답 형식 통일 (RFC 7807 Problem Details)
- [ ] 프론트엔드 에러 바운더리 개선

---

### 2.4 🟡 중간 - 로깅 시스템 개선

**현재 상태**: 기본 Python logging 사용

**개선안**:

```python
# src/api/logging_config.py
import logging
import sys
from logging.handlers import RotatingFileHandler

def setup_logging():
    logger = logging.getLogger("justjam")
    logger.setLevel(logging.INFO)

    # 콘솔 핸들러
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))

    # 파일 핸들러 (로테이션)
    file_handler = RotatingFileHandler(
        'logs/justjam.log',
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger
```

**작업 체크리스트**:
- [ ] 구조화된 로깅 설정
- [ ] 로그 로테이션 구현
- [ ] 요청/응답 로깅 미들웨어
- [ ] 에러 추적 (Sentry 통합 고려)

---

### 2.5 🟡 중간 - API 문서화 개선

**현재 상태**: FastAPI 기본 Swagger UI만 제공

**개선안**:
- OpenAPI 스키마 보강
- 예제 요청/응답 추가
- 에러 코드 문서화

```python
# 예시: 라우트에 상세 문서 추가
@router.post(
    "/",
    response_model=ProjectResponse,
    summary="프로젝트 생성",
    description="새로운 프로젝트를 생성하고 음원 파일을 업로드합니다.",
    responses={
        201: {"description": "프로젝트 생성 성공"},
        400: {"description": "잘못된 파일 형식"},
        401: {"description": "인증 필요"},
        413: {"description": "파일 크기 초과"}
    }
)
```

**작업 체크리스트**:
- [ ] 모든 엔드포인트에 상세 문서 추가
- [ ] Pydantic 스키마에 예제 추가 (`Field(example=...)`)
- [ ] 에러 응답 문서화
- [ ] API 버전 관리 전략 수립

---

## 3. 개선 사항

### 3.1 사용자 경험 (UX) 개선

#### 3.1.1 프로필 관리 완성
**현재 상태**: 설정 페이지 존재하나 닉네임 변경 UI 미완성

**필요 작업**:
- [ ] 닉네임 변경 폼 구현 (`PATCH /users/me` 연동)
- [ ] 프로필 이미지 업로드 (선택사항)
  - S3 또는 Cloudinary 연동
  - 이미지 리사이징 처리

#### 3.1.2 프로젝트 관리 개선
- [ ] 프로젝트 이름 변경 기능
- [ ] 프로젝트 복제 기능
- [ ] 프로젝트 정렬/필터 옵션 (날짜, 이름, 상태)
- [ ] 프로젝트 검색 기능
- [ ] 프로젝트 썸네일/커버 이미지

#### 3.1.3 플레이어 개선
- [ ] 키보드 단축키 지원 (Space: 재생/일시정지, M: 뮤트)
- [ ] 구간 반복 재생 (A-B 루프)
- [ ] 재생 속도 조절 (0.5x ~ 2.0x)
- [ ] 북마크 기능 (특정 구간 저장)

#### 3.1.4 악보/타브 뷰어 개선
- [x] 악보 줌 인/아웃
- [x] 인쇄 기능
- [ ] PDF 내보내기 (현재 브라우저 인쇄 연동)
- [ ] 타브 뷰어에서 현재 재생 위치 하이라이트

---

### 3.2 성능 최적화

#### 3.2.1 백엔드 최적화
- [ ] 음원 처리 캐싱 개선 (Redis)
- [ ] 대용량 파일 스트리밍 처리
- [ ] 비동기 작업 큐 개선 (현재 백그라운드 태스크 → Celery 고려)
- [x] 데이터베이스 쿼리 최적화 (N+1 문제 점검 - `joinedload` 적용)

#### 3.2.2 프론트엔드 최적화
- [ ] 이미지 최적화 (Next.js Image 컴포넌트 활용)
- [ ] 코드 스플리팅 개선
- [ ] 번들 사이즈 분석 및 최적화
- [ ] 서비스 워커 캐싱 (PWA)

---

### 3.3 코드 품질 개선

#### 3.3.1 린팅 및 포맷팅
- [ ] Python: Black + isort + flake8 설정
- [ ] TypeScript: ESLint + Prettier 설정 확인
- [ ] Pre-commit 훅 설정

#### 3.3.2 코드 구조 개선
- [ ] 백엔드 서비스 레이어 분리 (현재 라우트에 비즈니스 로직 혼재)
- [ ] 타입 힌트 완성도 향상
- [ ] 중복 코드 리팩토링

---

## 4. 향후 추가 기능

### 4.1 Phase 7: 협업 기능 (중기 계획)

#### 4.1.1 프로젝트 공유
```python
# 새로운 모델: ProjectMember
class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True)
    project_id = Column(String, ForeignKey("projects.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String)  # 'owner', 'editor', 'viewer'
    invited_at = Column(DateTime, default=datetime.utcnow)
    accepted_at = Column(DateTime, nullable=True)
```

**기능 목록**:
- [ ] 프로젝트 공유 링크 생성
- [ ] 이메일로 사용자 초대
- [ ] 공유 권한 관리 (읽기/편집)
- [ ] 공유 프로젝트 목록 표시

#### 4.1.2 실시간 협업 (장기 계획)
- [ ] WebSocket 기반 실시간 동기화
- [ ] 동시 편집 충돌 해결
- [ ] 실시간 커서 표시
- [ ] 채팅/코멘트 기능

---

### 4.2 Phase 8: 내보내기 기능 확장

#### 4.2.1 MIDI 내보내기
- [ ] 분리된 스템을 MIDI로 변환
- [ ] 악기별 MIDI 트랙 생성
- [ ] 템포/박자 메타데이터 포함

#### 4.2.2 다양한 포맷 지원
- [ ] PDF 악보 내보내기
- [ ] Guitar Pro 포맷 (.gp5, .gpx)
- [ ] MusicXML 다운로드
- [ ] WAV/MP3 개별 스템 다운로드

---

### 4.3 Phase 9: 모바일 지원

#### 4.3.1 반응형 개선
- [ ] 모바일 전용 레이아웃
- [ ] 터치 제스처 지원
- [ ] 모바일 최적화 플레이어

#### 4.3.2 PWA 구현
- [ ] 서비스 워커 설정
- [ ] 오프라인 지원
- [ ] 앱 설치 프롬프트
- [ ] 푸시 알림 (처리 완료 시)

---

### 4.4 Phase 10: 분석 및 학습 기능 (장기 계획)

#### 4.4.1 연주 분석
- [ ] 코드 진행 자동 감지
- [ ] 키(조성) 분석
- [ ] 곡 구조 분석 (인트로, 벌스, 코러스 등)

#### 4.4.2 연습 도우미
- [ ] 구간별 난이도 표시
- [ ] 느린 재생으로 연습
- [ ] 연습 기록 추적
- [ ] 진도 관리

---

## 5. 배포 계획

### 5.1 인프라 구성

#### 5.1.1 백엔드 배포 옵션
| 옵션 | 장점 | 단점 | 비용 |
|------|------|------|------|
| Fly.io | 간단한 배포, 글로벌 엣지 | GPU 미지원 | $5-20/월 |
| Railway | 쉬운 설정, PostgreSQL 포함 | 비용 예측 어려움 | $5-20/월 |
| AWS EC2 | 완전한 제어, GPU 옵션 | 복잡한 설정 | $50+/월 |
| CloudType | 한국 서버, 간단한 배포 | 제한된 리소스 | 무료-$10/월 |

**권장**: Fly.io 또는 Railway (MVP 단계)

#### 5.1.2 프론트엔드 배포
- **Vercel** (권장): Next.js 최적화, 무료 티어 제공
- 자동 프리뷰 배포
- 엣지 함수 지원

#### 5.1.3 데이터베이스
- **개발**: SQLite (현재)
- **프로덕션**: PostgreSQL (Supabase, Railway, Neon)

---

### 5.2 CI/CD 파이프라인

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      - run: pip install -r requirements.txt
      - run: pytest --cov=src tests/

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd client && npm ci
      - run: cd client && npm run lint
      - run: cd client && npm test

  deploy-backend:
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only

  deploy-frontend:
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

---

### 5.3 Docker 설정

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini .

# 환경 변수
ENV PYTHONPATH=/app

# 포트 노출
EXPOSE 8000

# 실행
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 6. 작업 우선순위 및 일정

### 6.1 즉시 해야 할 작업 (1-2주)

| 순서 | 작업 | 예상 소요 | 담당 |
|------|------|----------|------|
| 1 | 백엔드 테스트 코드 작성 | 3일 | Backend |
| 2 | 프로덕션 보안 강화 | 1일 | Backend |
| 3 | 에러 핸들링 개선 | 1일 | Backend |
| 4 | 프론트엔드 테스트 설정 | 2일 | Frontend |
| 5 | CI/CD 파이프라인 구축 | 1일 | DevOps |

### 6.2 단기 계획 (2-4주)

| 순서 | 작업 | 예상 소요 |
|------|------|----------|
| 1 | Docker 설정 | 1일 |
| 2 | 배포 환경 구성 | 2일 |
| 3 | 로깅 시스템 개선 | 1일 |
| 4 | API 문서화 개선 | 1일 |
| 5 | 닉네임 변경 UI | 0.5일 |

### 6.3 중기 계획 (1-2개월)

| 순서 | 작업 | 예상 소요 |
|------|------|----------|
| 1 | 플레이어 개선 (단축키, 구간 반복) | 3일 |
| 2 | PDF 내보내기 | 2일 |
| 3 | 프로젝트 공유 기능 | 5일 |
| 4 | 성능 최적화 | 3일 |

### 6.4 장기 계획 (3개월+)

- 실시간 협업 기능
- 모바일 앱 (PWA)
- 연주 분석 기능
- MIDI 내보내기
- 다국어 지원

---

## 7. 리스크 및 주의사항

### 7.1 기술적 리스크
1. **GPU 의존성**: Demucs 음원 분리는 CPU에서도 동작하나 느림 → 프로덕션에서 GPU 인스턴스 고려
2. **파일 저장소**: 현재 로컬 파일 시스템 사용 → S3/GCS 전환 필요
3. **동시성 처리**: 다수 사용자 동시 처리 시 리소스 부족 가능

### 7.2 보안 리스크
1. **환경 변수 관리**: 시크릿 키 노출 주의
2. **파일 업로드**: 악성 파일 업로드 방지 검증 필요
3. **CORS 설정**: 프로덕션에서 특정 도메인만 허용

### 7.3 비용 리스크
1. **클라우드 비용**: GPU 인스턴스는 비용이 높음
2. **저장소 비용**: 오디오 파일은 용량이 큼
3. **트래픽 비용**: 스트리밍 트래픽 고려

---

## 8. 참고 자료

### 8.1 관련 문서
- [001-initial-architecture-2026-01-15.md](./001-initial-architecture-2026-01-15.md)
- [002-metronome-improvements-2026-01-20.md](./002-metronome-improvements-2026-01-20.md)
- [003-auth-and-db-integration-2026-01-20.md](./003-auth-and-db-integration-2026-01-20.md)

### 8.2 기술 스택 문서
- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/docs)
- [NextAuth.js](https://next-auth.js.org/)
- [Demucs](https://github.com/facebookresearch/demucs)
- [WaveSurfer.js](https://wavesurfer.xyz/)

---

**작성자**: Claude AI
**최종 업데이트**: 2026-01-21
