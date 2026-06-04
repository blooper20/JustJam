# JustJam 배포 가이드 (Deployment Guide)

본 문서는 JustJam 플랫폼의 백엔드와 프론트엔드를 배포하기 위한 상세 가이드입니다.

---

## 🏗️ 시스템 아키텍처 개요

- **Frontend**: Next.js (App Router), deployed on Vercel or similar.
- **Backend**: FastAPI (Python 3.10+), deployed on Fly.io, Railway, or AWS.
- **Database**: PostgreSQL (Supabase or Managed RDS).
- **Background Tasks**: Celery + Redis.
- **Error Monitoring**: Sentry.

---

## 1. 환경 변수 설정 (Environment Variables)

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://justjam:justjam@localhost:5432/justjam
POSTGRES_USER=justjam
POSTGRES_PASSWORD=justjam
POSTGRES_DB=justjam

# JWT (Production 필수 설정)
JWT_SECRET_KEY=your-secret-key-at-least-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis (Celery Broker & Backend)
REDIS_URL=redis://localhost:6379/0

# Sentry
SENTRY_DSN=your-backend-sentry-dsn

# App Environment
APP_ENV=production

# CORS Allowed Origins (쉼표로 구분된 프론트엔드 주소)
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000
```

### Frontend (.env.production)
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SENTRY_DSN=your-frontend-sentry-dsn
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-nextauth-secret

# Social Login
GOOGLE_CLIENT_ID=your-google-id
GOOGLE_CLIENT_SECRET=your-google-secret
KAKAO_CLIENT_ID=your-kakao-id
KAKAO_CLIENT_SECRET=your-kakao-secret
```

---

## 2. 백엔드 배포 (AWS EC2 추천)

백엔드는 `FastAPI`, `Celery Worker`, `PostgreSQL`, `Redis` 총 4개의 컨테이너를 요구하며 Demucs 오디오 처리를 위해 메모리가 많이 필요합니다. 따라서 클라우드 PaaS(Fly.io 등)보다는 단일 가상 서버(AWS EC2, t3.large 권장)에 **Docker Compose**로 통합 배포하는 것을 강력히 권장합니다.

### 배포 환경 구성 (원클릭 쉘 스크립트 활용)
EC2 인스턴스(Ubuntu 22.04 LTS 권장) 접속 후 프로젝트를 클론하고, 배포 스크립트를 실행하면 즉시 구동됩니다.

1. **프로젝트 클론 및 이동**
   ```bash
   git clone https://github.com/blooper20/JustJam.git
   cd JustJam
   ```
2. **배포 스크립트 권한 부여 및 실행**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
3. **환경 변수(.env) 설정**
   스크립트 실행 후 생성된 `.env` 파일을 열어 `JWT_SECRET_KEY` 및 `DATABASE_URL` 등 운영 환경에 맞는 비밀번호와 `ALLOWED_ORIGINS`(프론트엔드 URL)를 수정합니다.
4. **재가동 (Docker Compose V2 사용)**
   ```bash
   sudo docker compose -f docker-compose.prod.yml restart
   ```

### 데이터베이스 마이그레이션 (Database Migrations)
`docker-compose.prod.yml`의 `backend` 컨테이너 시작 명령어로 `alembic upgrade head`가 기본 내장되어 있어, 서비스 가동 시 DB 스키마가 자동으로 마이그레이션됩니다. 
수동으로 마이그레이션을 다시 적용하고 싶은 경우 아래 명령어를 활용하세요:
```bash
sudo docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

### Nginx 및 HTTPS 설정 (필수)
Vercel에 배포된 프론트엔드와 통신하기 위해선 백엔드도 HTTPS 통신이 강제됩니다. 
스크립트를 통해 설치된 Nginx를 설정하고, `certbot`으로 인증서를 발급받으세요.
```bash
sudo certbot --nginx -d api.yourdomain.com
```

---

## 3. 셀러리(Celery) 워커 및 레거시 종속성 배포 제외

### 1) 워커 동시성 설정
프로덕션 `docker-compose.prod.yml` 파일에는 Celery 워커가 이미 정의되어 함께 실행됩니다.
VRAM 초과(OOM)를 방지하기 위해 반드시 `concurrency=1` (`-c 1`)로 설정되어 실행되도록 보장해야 합니다.

### 2) 레거시 전사/악보 생성 종속성 배포 제외
JustJam은 가벼운 전송 및 안정적인 오디오 처리를 위해 레거시 악보/타브 전사 기능의 종속성을 프로덕션 배포에서 제외하였습니다:
- `basic-pitch` (Spotify Basic Pitch), `music21` 등의 대용량 패키지는 프로덕션 빌드 의존성(`requirements.txt` / Docker 이미지)에서 제외되어 빌드 속도와 컨테이너 용량이 대폭 축소되었습니다.
- 분리된 오디오 트랙을 기반으로 한 스마트 음원 분리 및 믹서 재생 기능에 집중하도록 경량화되었습니다.


---

## 4. 프론트엔드 배포 (Vercel 예시)

1. Vercel 대시보드에서 프로젝트 연결.
2. Root Directory를 `client`로 설정.
3. Build Command: `npm run build`.
4. Install Command: `npm install`.
5. 환경 변수 입력.
6. "Deploy" 클릭.

---

## 5. Sentry 통합 및 소스 맵 업로드

배포 시 Sentry 소스 맵이 업로드되도록 CI/CD 설정에 `SENTRY_AUTH_TOKEN`을 포함해야 합니다.

---

## 6. 체크리스트 (Pre-deployment Checklist)

- [ ] `APP_ENV`가 `production`으로 설정되었는가? (HTTPS 리다이렉트 활성화)
- [ ] CORS 설정에 프론트엔드 도메인이 포함되었는가? (`src/api/main.py`)
- [ ] Rate limiting 수치가 적절한가?
- [ ] 모든 API 엔드포인트가 `/api/v1/` prefix를 사용하고 있는가?
- [ ] PWA manifest 및 아이콘이 올바르게 구성되었는가?

---

도움이 필요하시면 개발팀에 문의하세요.
