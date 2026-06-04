# JustJam 배포 가이드 (Deployment Guide)

본 문서는 JustJam 플랫폼의 프론트엔드(Next.js)와 백엔드(FastAPI + Celery + PostgreSQL + Redis)를 배포하기 위한 상세 가이드입니다. 

특히 **Vercel(프론트엔드) + 클라우드 VPS(백엔드, Docker Compose)** 연동 시나리오를 기준으로 환경 변수 설정 및 보안 통신(HTTPS) 구축 방법을 설명합니다.

---

## 🏗️ 시스템 아키텍처 개요

```mermaid
graph TD
    User([사용자 브라우저]) -->|HTTPS| Frontend[프론트엔드: Vercel]
    User -->|HTTPS - Port 443| Nginx[역방향 프록시: Nginx]
    subgraph Cloud VPS (Docker Compose)
        Nginx -->|HTTP - Port 8000| Backend[백엔드: FastAPI]
        Backend -->|DB Connection| Postgres[(PostgreSQL)]
        Backend -->|Task Queue| Redis[(Redis)]
        Worker[셀러리 워커: Celery] -->|Task Queue| Redis
        Worker -->|DB Connection| Postgres
    end
```

- **Frontend**: Next.js (App Router) -> **Vercel** 배포 (HTTPS 기본 제공)
- **Backend**: FastAPI (Python 3.10+) -> **Cloud VPS** (AWS EC2, Lightsail 등 Ubuntu 22.04 LTS 권장)에서 **Docker Compose** 배포
- **Database**: PostgreSQL (Docker 내부 컨테이너 또는 외부 RDS/Supabase 사용 가능)
- **Caching & Broker**: Redis (Docker 내부 컨테이너)
- **Background Worker**: Celery (Docker 내부 컨테이너)

---

## 1. 환경 변수 설정 (Environment Variables)

프로덕션 배포 시 필수적으로 설정해야 하는 중요 환경 변수 목록입니다.

### 1) 백엔드 환경 변수 (.env)
백엔드 가상 서버(VPS)의 프로젝트 루트 디렉터리에 `.env` 파일을 생성하고 아래 값들을 입력합니다.

| 변수명 | 설명 / 권장 값 | 예시 |
| :--- | :--- | :--- |
| `APP_ENV` | 애플리케이션 실행 환경 (프로덕션 필수) | `production` |
| `JWT_SECRET_KEY` | JWT 토큰 서명용 비밀키 (최소 32글자 이상의 임의 문자열) | `openssl rand -hex 32` 결과물 사용 |
| `DATABASE_URL` | 데이터베이스 연결 URI. 로컬 컨테이너 사용 시 아래 예시 참고. | `postgresql://justjam:securepassword@postgres:5432/justjam` |
| `ALLOWED_ORIGINS` | CORS 허용 도메인. **Vercel 프론트엔드 배포 주소**를 반드시 포함해야 함. | `https://justjam-frontend.vercel.app,http://localhost:3000` |
| `REDIS_URL` | Celery 브로커 및 캐싱용 Redis URI | `redis://redis:6379/0` |
| `SENTRY_DSN` | Sentry 오류 모니터링 DSN (선택 사항) | `https://your-dsn@sentry.io/12345` |
| `POSTGRES_USER` | Docker 내 PostgreSQL 사용자명 | `justjam` |
| `POSTGRES_PASSWORD` | Docker 내 PostgreSQL 비밀번호 (강력한 비밀번호 사용 필수) | `secure_database_password_here` |
| `POSTGRES_DB` | Docker 내 PostgreSQL 데이터베이스 이름 | `justjam` |

> [!WARNING]
> 프로덕션 환경의 `ALLOWED_ORIGINS`에는 Vercel 호스팅 도메인을 정확히 입력해야 합니다. 그렇지 않으면 브라우저에서 CORS 에러로 인해 API 요청이 차단됩니다.

### 2) 프론트엔드 환경 변수 (.env.production 또는 Vercel Dashboard 설정)
Vercel 프로젝트 설정의 **Environment Variables** 메뉴에서 다음 변수들을 추가합니다.

| 변수명 | 설명 | 예시 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | 도메인이 적용된 HTTPS 백엔드 API 주소 | `https://api.justjam.ai` |
| `NEXTAUTH_URL` | NextAuth 서비스 인증 콜백 URL (프론트엔드 주소) | `https://justjam-frontend.vercel.app` |
| `NEXTAUTH_SECRET` | NextAuth 암호화 토큰 비밀키 | 임의의 무작위 문자열 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 보안 비밀번호 | `GOCSPX-xxxx` |
| `KAKAO_CLIENT_ID` | Kakao OAuth REST API 키 | `kakao_client_id` |
| `KAKAO_CLIENT_SECRET` | Kakao OAuth 클라이언트 보안 비밀번호 | `kakao_secret` |

---

## 2. 배포 시나리오: Vercel Frontend + Cloud VPS Backend

### 1) 혼합 콘텐츠(Mixed Content) 방지와 HTTPS 필수성
Vercel은 배포된 웹사이트에 자동으로 **HTTPS**를 강제 적용합니다. 브라우저 보안 정책 상, **HTTPS 사이트 내에서 HTTP API 엔드포인트로 요청을 보낼 수 없습니다 (Mixed Content 차단)**.
따라서 Cloud VPS에 배포된 FastAPI 백엔드 역시 **반드시 도메인을 연결하고 SSL/TLS 인증서(HTTPS)를 적용**해야 Vercel 프론트엔드와 정상 통신이 가능합니다.

### 2) 백엔드 VPS 초기 설정 및 실행
클라우드 가상 서버(Ubuntu 22.04 LTS 권장) 환경에서 백엔드를 설정하는 단계입니다.

1. **저장소 클론 및 폴더 이동**
   ```bash
   git clone https://github.com/blooper20/JustJam.git
   cd JustJam
   ```

2. **환경 설정 스크립트 실행**
   배포 스크립트(`deploy.sh`)는 Docker 설치 및 시스템 의존성 설치를 자동으로 처리합니다.
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```
   이 스크립트는 템플릿 파일로부터 `.env`를 자동으로 생성합니다.

3. **환경 변수 `.env` 파일 편집**
   스크립트가 생성한 `.env` 파일을 열어 운영 환경에 맞게 정보를 수정합니다.
   ```bash
   nano .env
   ```
   - `APP_ENV=production` 변경
   - `JWT_SECRET_KEY`를 안전한 비밀값으로 설정
   - `DATABASE_URL`에 올바른 PostgreSQL 정보 입력
   - `ALLOWED_ORIGINS`에 Vercel 프론트엔드 주소(`https://justjam-frontend.vercel.app`) 기입

4. **프로덕션 컨테이너 빌드 및 백그라운드 실행**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

### 3) 데이터베이스 마이그레이션 실행
`docker-compose.prod.yml`은 최초 기동 시 자동으로 마이그레이션을 실행하지만, 배포 도중 혹은 스키마 변경 시 수동으로 데이터베이스 마이그레이션을 최신 상태로 유지하려면 백엔드 컨테이너 내에서 Alembic 명령을 수동으로 수행해야 합니다.

아래 명령어를 복사하여 실행하세요:
```bash
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## 3. Nginx 및 Certbot을 활용한 HTTPS 역방향 프록시 구성

외부의 HTTPS 요청(Port 443)을 받아 Docker 내부의 FastAPI 백엔드 컨테이너(Port 8000)로 라우팅하고, Certbot을 통해 SSL 인증서를 적용하는 방법입니다.

### 1) Nginx 서버 블록(가상 호스트) 설정
Nginx 설정 파일 `/etc/nginx/sites-available/justjam`을 생성하여 다음과 같이 역방향 프록시(Reverse Proxy)를 작성합니다.

```nginx
server {
    listen 80;
    server_name api.yourdomain.com; # 본인의 백엔드 API 도메인 기입

    # API 요청 전달
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSockets 지원 (협업 및 스트리밍 시 필요)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 스템 등 대용량 파일 서빙 시 최대 요청 바디 제한 완화
    client_max_body_size 100M;
}
```

설정 파일을 활성화하고 Nginx를 테스트 및 재시작합니다:
```bash
sudo ln -s /etc/nginx/sites-available/justjam /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 2) Certbot을 통한 SSL 인증서 무료 발급 및 자동 갱신
Let's Encrypt 무료 인증서를 자동으로 획득하고 Nginx 환경에 HTTPS 포트(443) 리다이렉트 설정을 내장시킵니다.

```bash
sudo certbot --nginx -d api.yourdomain.com
```
안내 문구에 따라 이메일 주소를 입력하고 약관에 동의하면, Certbot이 Nginx 설정을 자동으로 수정하여 HTTPS를 적용합니다.

---

## 4. 프론트엔드 배포 (Vercel)

프론트엔드 소스 코드는 Next.js를 사용하여 Vercel 플랫폼에 간단히 배포할 수 있습니다.

1. **Vercel 연결 및 프로젝트 생성**: Vercel 대시보드에서 GitHub 저장소(`JustJam`)를 연동합니다.
2. **Root Directory 설정**: Next.js 코드가 포함된 하위 폴더인 `client`를 루트 디렉터리로 설정합니다.
3. **Build Settings 구성**:
   - Build Command: `npm run build`
   - Install Command: `npm install`
4. **환경 변수 구성**: 상단 [환경 변수 설정](#1-환경-변수-설정-environment-variables)의 프론트엔드 전용 변수들(`NEXT_PUBLIC_API_URL`, `NEXTAUTH_SECRET` 등)을 추가합니다.
5. **배포**: "Deploy" 버튼을 클릭하면 Next.js 프로젝트가 빌드 및 배포됩니다.

---

## 5. 셀러리(Celery) 워커 및 리소스 제약사항

- **메모리(RAM) 요구사항**: 오디오 스템 분리 라이브러리인 Demucs는 메모리 소모량이 매우 큽니다. 프로덕션 가상 서버는 최소 **4GB RAM** (8GB 권장, AWS EC2 `t3.large` 이상) 인스턴스를 권장합니다.
- **워커 동시성 제한**: VRAM/RAM 초과에 따른 컨테이너 종료(OOM)를 미연에 방지하고자 프로덕션 `docker-compose.prod.yml` 환경에서는 Celery 워커가 **concurrency=1** (`-c 1`)로 하드코딩되어 있습니다. 동시 요청이 많더라도 순차 처리를 통해 안정성을 확보합니다.
- **경량화**: 빌드 시간 단축 및 불필요한 하드웨어 부하 경감을 위해 레거시 악보 전사 라이브러리(`basic-pitch`, `music21`) 등은 프로덕션 패키지 의존성에서 배포 제외 처리되었습니다.

---

## 6. 배포 전 체크리스트 (Pre-deployment Checklist)

- [ ] `.env` 파일 내 `APP_ENV` 변수가 `production`으로 설정되어 HTTPS 강제 미들웨어가 켜져 있는가?
- [ ] CORS 설정 `ALLOWED_ORIGINS`에 Vercel 배포 URL이 오타 없이 포함되었는가?
- [ ] DB 마이그레이션이 최신 상태인가? (`alembic upgrade head` 명령어 통과)
- [ ] Nginx 설정 및 Certbot SSL 인증서 갱신 설정이 작동하는가?
- [ ] Vercel 프론트엔드 환경 변수 `NEXT_PUBLIC_API_URL`이 HTTP가 아닌 `https://`로 시작되는가?

---

도움이 필요하거나 시스템 장애 발생 시 데브옵스/개발팀 담당자에게 문의하십시오.
