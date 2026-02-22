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
DATABASE_URL=postgresql://user:password@host:port/dbname

# JWT
JWT_SECRET=your-secret-key-at-least-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Redis (Celery)
REDIS_URL=redis://your-redis-host:6379/0

# Sentry
SENTRY_DSN=your-backend-sentry-dsn

# App Environment
APP_ENV=production
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

## 2. 백엔드 배포 (Fly.io 예시)

백엔드는 Docker를 사용하여 배포하는 것을 권장합니다.

### Dockerfile 준비
이미 `Dockerfile`이 프로젝트 루트에 존재해야 합니다.

### 배포 환경 구성
1. `fly launch` 실행하여 앱 생성.
2. `fly secrets set DATABASE_URL=... REDIS_URL=...` 등으로 비밀 정보 설정.
3. `fly deploy` 실행.

### 데이터베이스 마이그레이션
배포 시 `alembic upgrade head`가 자동으로 실행되도록 `Dockerfile`의 ENTRYPOINT에 추가하거나, 배포 후 수동 실행합니다.

---

## 3. 셀러리(Celery) 워커 실행

백엔드와 동일한 환경에서 별도의 프로세스로 워커를 실행해야 합니다.

```bash
celery -A src.api.celery_app worker --loglevel=info
```

환경에 따라 Docker 컨테이너를 하나 더 띄워 워커를 실행하는 것이 좋습니다.

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
