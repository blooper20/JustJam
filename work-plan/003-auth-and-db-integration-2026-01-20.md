# 인증 및 데이터베이스 통합 계획
**날짜**: 2026-01-20
**목표**: 소셜 로그인(카카오, 구글) 구현 및 사용자 데이터베이스 통합으로 프로젝트 소유권 관리

## 1. 데이터베이스 스키마 설계 (SQLAlchemy)
현재 SQLite 데이터베이스는 파일 기반(`projects.db`)입니다. `User` 모델을 추가하고 `Project`와 연결해야 합니다.

### 1.1. User 모델
*   `id`: Integer/UUID (기본 키)
*   `email`: String (고유, 인덱스) - Google/Kakao에서 가져옴
*   `nickname`: String
*   `profile_image`: String (URL)
*   `provider`: String (Enum: 'google', 'kakao')
*   `provider_id`: String (제공자의 고유 ID)
*   `created_at`: DateTime

### 1.2. Project 모델 업데이트
*   `user_id` 추가: `User.id`에 연결된 외래 키
*   관계 추가: `User`는 여러 `Projects`를 가짐

## 2. 백엔드 구현 (FastAPI)

### 2.1. 인증 API
FastAPI에서 OAuth 플로우를 전체적으로 처리하는 대신(리다이렉트로 인해 복잡함), 프론트엔드에서 전송된 토큰을 검증하거나 간단한 "Backend-for-Frontend" 패턴을 사용합니다.

**권장 접근 방식**:
1.  **프론트엔드**가 **NextAuth.js**를 통해 OAuth 처리 (Next.js 표준)
2.  **프론트엔드**가 로그인 성공 시 사용자 프로필(email, provider_id)을 **백엔드**로 전송
3.  **백엔드**가 사용자 존재 여부 확인 → 사용자 생성 또는 업데이트 → 범용 **API 액세스 토큰**(JWT) 반환
4.  프론트엔드는 이후 요청에 이 JWT 사용

### 2.2. 새로운 엔드포인트
*   `POST /auth/login`: 제공자 정보를 받아 JWT 액세스 토큰 반환
*   `GET /users/me`: 현재 사용자 정보 반환
*   `GET /projects`: **현재 사용자의** 프로젝트만 반환하도록 업데이트

### 2.3. 보안 의존성
*   보호된 라우트에서 JWT 헤더를 검증하는 `get_current_user` 의존성 생성

## 3. 프론트엔드 구현 (Next.js + NextAuth.js)

### 3.1. NextAuth.js v5 설정
*   `next-auth` 설치
*   제공자 구성:
    *   Google Provider
    *   Kakao Provider (Kakao Developers 애플리케이션 활성화 필요)
*   `callbacks` 구성:
    *   `signIn`: 백엔드 `/auth/login` 호출하여 사용자 데이터 동기화 및 백엔드 JWT 획득
    *   `session`: API 호출에 사용할 수 있도록 세션 객체에 백엔드 JWT 주입

### 3.2. UI 컴포넌트
*   **로그인 페이지**: "Google로 계속하기" 및 "Kakao로 계속하기" 간단한 버튼
*   **헤더 프로필**: 사용자 아바타/이름 및 로그아웃 버튼 표시
*   **미들웨어**: `/projects` 라우트 보호; 인증되지 않은 사용자를 로그인으로 리다이렉트

## 4. 작업 체크리스트

### Phase 1: 백엔드 기반
- [ ] `src/api/models.py`에 `User` 모델 정의
- [ ] `Project` 모델에 `user_id` 추가 및 마이그레이션 생성 (또는 DB 재생성)
- [ ] 백엔드 토큰 발급을 위한 `PyJWT` 로직 구현
- [ ] `/auth/login` 엔드포인트 로직 생성 (페이로드에서 사용자 동기화)

### Phase 2: 프론트엔드 인증 설정
- [ ] `next-auth` 설치 (Next.js 버전 선호도에 따라 `@auth/core`)
- [ ] Google Cloud Console 및 Kakao Developers에서 OAuth 자격 증명 생성
- [ ] 환경 변수 추가 (`GOOGLE_CLIENT_ID`, `KAKAO_CLIENT_ID` 등)
- [ ] `app/api/auth/[...nextauth]/route.ts` 구현

### Phase 3: 통합
- [ ] `MultiTrackPlayer` 및 프로젝트 생성 API를 업데이트하여 `Authorization: Bearer <token>` 전송
- [ ] 백엔드 `create_project`를 업데이트하여 토큰에서 `user_id` 할당
- [ ] `get_projects`를 업데이트하여 `user.id`로 필터링

### Phase 4: UI 개선
- [ ] 로그인 페이지 디자인 (`app/login/page.tsx`)
- [ ] 로그인 상태를 표시하도록 헤더 업데이트

---

## 📋 파일 분석

### 문서 개요
이 문서는 JustJam 프로젝트에 소셜 로그인(카카오, 구글) 기능과 사용자 데이터베이스를 통합하는 전체 계획을 담고 있습니다.

### 주요 구성 요소
1. **데이터베이스 설계**: SQLAlchemy를 사용한 User 및 Project 모델 정의
2. **백엔드 구현**: FastAPI 기반 인증 API 및 JWT 토큰 관리
3. **프론트엔드 구현**: NextAuth.js를 활용한 소셜 로그인 UI
4. **단계별 작업 계획**: 4개 Phase로 구분된 체계적인 구현 로드맵

### 아키텍처 특징
- **BFF(Backend-for-Frontend) 패턴**: 프론트엔드에서 OAuth 처리, 백엔드에서 사용자 관리 및 JWT 발급
- **토큰 기반 인증**: NextAuth.js 세션과 백엔드 JWT를 결합한 이중 토큰 전략
- **관계형 데이터 모델**: User-Project 일대다 관계로 프로젝트 소유권 명확화

---

## 💡 개선 방안

### 1. 보안 강화
- **Refresh Token 추가**: 장기 세션 유지를 위한 Refresh Token 메커니즘 구현
- **토큰 만료 정책**: Access Token 짧은 만료 시간(15분), Refresh Token 긴 만료 시간(7일) 설정
- **CSRF 보호**: NextAuth.js의 CSRF 토큰 활성화
- **Rate Limiting**: `/auth/login` 엔드포인트에 요청 제한 추가 (예: 분당 5회)

### 2. 데이터베이스 최적화
- **복합 인덱스 추가**: `(provider, provider_id)` 복합 인덱스로 조회 성능 향상
- **Soft Delete**: User 및 Project에 `deleted_at` 필드 추가하여 데이터 복구 가능하도록 구현
- **마이그레이션 전략**: Alembic을 사용한 체계적인 DB 마이그레이션 관리

### 3. 사용자 경험 개선
- **로딩 상태**: 로그인 프로세스 중 로딩 인디케이터 추가
- **에러 핸들링**: 소셜 로그인 실패 시 사용자 친화적인 에러 메시지
- **자동 로그인**: "로그인 상태 유지" 옵션 제공
- **프로필 편집**: 사용자가 닉네임 및 프로필 이미지 변경 가능한 설정 페이지

### 4. 확장성 고려
- **다중 제공자 지원**: 네이버, 애플 로그인 등 추가 제공자 확장 가능한 구조
- **역할 기반 접근 제어(RBAC)**: User 모델에 `role` 필드 추가 (예: 'user', 'admin')
- **팀 협업 기능**: 프로젝트 공유를 위한 `ProjectMember` 중간 테이블 고려

### 5. 모니터링 및 로깅
- **인증 로그**: 로그인 시도, 성공, 실패 이벤트 로깅
- **성능 모니터링**: JWT 검증 및 DB 쿼리 성능 추적
- **보안 감사**: 의심스러운 로그인 패턴 감지 시스템

---

## 🔧 수정 사항 정리

### 추가된 내용
1. **보안 강화 섹션**: Refresh Token, Rate Limiting, CSRF 보호
2. **데이터베이스 최적화**: 복합 인덱스, Soft Delete, Alembic 마이그레이션
3. **UX 개선 사항**: 로딩 상태, 에러 핸들링, 프로필 편집 기능
4. **확장성 고려사항**: 다중 제공자, RBAC, 팀 협업 기능
5. **모니터링 전략**: 인증 로그, 성능 추적, 보안 감사

### 권장 수정 사항
1. **User 모델 확장**:
   ```python
   # 추가 필드
   role: String (Enum: 'user', 'admin')
   last_login: DateTime
   is_active: Boolean
   deleted_at: DateTime (nullable)
   ```

2. **새로운 엔드포인트**:
   - `POST /auth/refresh`: Refresh Token으로 새 Access Token 발급
   - `POST /auth/logout`: 토큰 무효화
   - `PATCH /users/me`: 사용자 프로필 업데이트
   - `DELETE /users/me`: 계정 삭제 (Soft Delete)

3. **환경 변수 추가**:
   ```env
   JWT_SECRET_KEY=<랜덤 생성>
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=15
   REFRESH_TOKEN_EXPIRE_DAYS=7
   ```

---

## 📝 작업 순서 및 상세 체크리스트

### ✅ Phase 1: 백엔드 기반 구축 (예상 소요: 2-3일)

#### 1.1 데이터베이스 모델링
- [x] `src/api/models.py`에 `User` 모델 정의
  - [x] 기본 필드 (id, email, nickname, profile_image, provider, provider_id, created_at)
  - [x] 추가 필드 (role, last_login, is_active, deleted_at)
  - [x] 복합 인덱스 설정: `Index('idx_provider_id', 'provider', 'provider_id')`
- [x] `Project` 모델에 `user_id` 외래 키 추가
- [x] User-Project 관계 설정: `relationship("Project", back_populates="owner")`
- [x] Alembic 마이그레이션 파일 생성: `alembic revision --autogenerate -m "Add User model"`
- [x] 마이그레이션 실행: `alembic upgrade head`

#### 1.2 JWT 토큰 관리
- [x] `PyJWT` 라이브러리 설치: `pip install pyjwt[crypto]`
- [x] `src/api/auth/jwt.py` 생성
  - [x] `create_access_token(user_id, expires_delta)` 함수
  - [x] `create_refresh_token(user_id)` 함수
  - [x] `verify_token(token)` 함수
- [x] 환경 변수 설정 (`.env` 파일)

#### 1.3 인증 엔드포인트
- [x] `src/api/routes/auth.py` 생성
  - [x] `POST /auth/login`: 사용자 동기화 및 토큰 발급
  - [x] `POST /auth/refresh`: Refresh Token으로 Access Token 갱신
  - [x] `POST /auth/logout`: 토큰 무효화 (Redis 블랙리스트 사용 권장 - *현재는 클라이언트 처리로 구현됨*)
- [x] `src/api/dependencies.py`에 `get_current_user` 의존성 추가
- [x] Rate Limiting 미들웨어 추가: `slowapi` 라이브러리 사용

#### 1.4 사용자 관리 엔드포인트
- [x] `src/api/routes/users.py` 생성
  - [x] `GET /users/me`: 현재 사용자 정보 조회
  - [x] `PATCH /users/me`: 사용자 프로필 업데이트
  - [x] `DELETE /users/me`: 계정 삭제 (Soft Delete)

---

### ✅ Phase 2: 프론트엔드 인증 설정 (예상 소요: 2-3일)

#### 2.1 NextAuth.js 설치 및 설정
- [x] `next-auth` 설치: `npm install next-auth`
- [x] `app/api/auth/[...nextauth]/route.ts` 생성
  - [x] Google Provider 설정
  - [x] Kakao Provider 설정
  - [x] `signIn` callback: 백엔드 `/auth/login` 호출
  - [x] `session` callback: 백엔드 JWT를 세션에 주입
  - [x] `jwt` callback: 토큰 갱신 로직 (초기 로그인 시 토큰 획득 구현함)

#### 2.2 OAuth 자격 증명 생성
- [x] Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
  - [x] 승인된 리디렉션 URI 설정: `http://localhost:3000/api/auth/callback/google`
- [x] Kakao Developers에서 애플리케이션 생성
  - [x] Redirect URI 설정: `http://localhost:3000/api/auth/callback/kakao`
  - [x] 동의 항목 설정: 이메일, 프로필 정보

#### 2.3 환경 변수 설정
- [x] `.env.local` 파일 생성
  ```env
  NEXTAUTH_URL=http://localhost:3000
  NEXTAUTH_SECRET=<랜덤 생성>
  GOOGLE_CLIENT_ID=<Google Console에서 발급>
  GOOGLE_CLIENT_SECRET=<Google Console에서 발급>
  KAKAO_CLIENT_ID=<Kakao Developers에서 발급>
  KAKAO_CLIENT_SECRET=<Kakao Developers에서 발급>
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```

---

### ✅ Phase 3: 통합 및 기능 연결 (예상 소요: 2일)

#### 3.1 API 클라이언트 업데이트
- [x] `lib/api-client.ts` 생성 또는 업데이트
  - [x] Axios 인스턴스 생성
  - [x] 요청 인터셉터: Authorization 헤더에 JWT 추가
  - [x] 응답 인터셉터: 401 에러 시 토큰 갱신 또는 로그아웃(클라이언트 측에서 로그아웃 처리)

#### 3.2 프로젝트 생성/조회 업데이트
- [x] 백엔드 `POST /projects` 엔드포인트 수정
  - [x] `get_current_user` 의존성 추가
  - [x] `user_id` 자동 할당
- [x] 백엔드 `GET /projects` 엔드포인트 수정
  - [x] 현재 사용자의 프로젝트만 필터링: `filter(Project.user_id == current_user.id)`
- [x] 프론트엔드 `MultiTrackPlayer` 컴포넌트 업데이트
  - [x] 프로젝트 생성 시 Authorization 헤더 포함 (`api-client.ts` 통해 자동 처리)

#### 3.3 미들웨어 설정
- [x] `middleware.ts` 생성
  - [x] `/projects` 경로 보호
  - [x] 인증되지 않은 사용자를 `/login`으로 리다이렉트

---

### ✅ Phase 4: UI 개선 및 마무리 (예상 소요: 2일)

#### 4.1 로그인 페이지
- [x] `app/login/page.tsx` 생성
- [x] "Google로 계속하기" 버튼 (Google 브랜드 가이드라인 준수)
- [x] "Kakao로 계속하기" 버튼 (Kakao 브랜드 가이드라인 준수)
- [x] 로딩 상태 표시 (자체 로딩 UI 및 Sonner 토스트 적용)
- [x] 에러 메시지 표시 (로그인 실패 시 사용자 알림 적용)

#### 4.2 헤더 컴포넌트
- [x] `components/Header.tsx` 업데이트
  - [x] 로그인 상태 확인: `useSession()` 훅 사용
  - [x] 사용자 아바타 및 이름 표시
  - [x] 드롭다운 메뉴: 프로필, 설정, 로그아웃
  - [x] 로그아웃 버튼: `signOut()` 함수 호출

#### 4.3 프로필 설정 페이지
- [x] `app/settings/page.tsx` 생성
  - [ ] 닉네임 변경 폼 (추후 구현)
  - [ ] 프로필 이미지 업로드 (선택 사항 - 추후 구현)
  - [x] 계정 삭제 버튼 (확인 모달 포함)

#### 4.4 에러 처리 및 UX
- [x] 전역 에러 바운더리 설정 (Next.js error.tsx 활용)
- [x] 토스트 알림 라이브러리 추가: `sonner` 적용됨
- [x] 로그인 실패 시 사용자 친화적인 메시지
- [x] 네트워크 에러 처리 (Axios Interceptor 및 Toast 알림)

---

### ✅ Phase 5: 테스트 및 배포 준비 (예상 소요: 1-2일)

#### 5.1 단위 테스트
- [ ] 백엔드 JWT 함수 테스트: `pytest`
- [ ] 백엔드 인증 엔드포인트 테스트
- [ ] 프론트엔드 로그인 플로우 테스트: `Jest` + `React Testing Library`

#### 5.2 통합 테스트
- [ ] 전체 인증 플로우 E2E 테스트: `Playwright` 또는 `Cypress`
- [ ] 프로젝트 생성 및 조회 권한 테스트

#### 5.3 보안 검토
- [ ] JWT 시크릿 키 강도 확인 (프로덕션 배포 전 필수)
- [ ] HTTPS 사용 여부 확인 (프로덕션)
- [x] CORS 설정 검토 (FastAPI CORSMiddleware 적용됨)
- [x] SQL Injection 방지 확인 (SQLAlchemy ORM 사용)

#### 5.4 문서화
- [x] API 문서 업데이트: FastAPI Swagger UI (/docs)
- [x] README.md 업데이트: 환경 변수 설정 가이드
- [ ] 배포 가이드 작성 (Vercel + Fly.io/CloudType 등)

---

### ✅ Phase 6: 대시보드 고도화 및 리소스 최적화 (2026-01-21)
- [x] **통계 로직 정밀화**: '보유 중' vs '생성 가능' 상태 구분 (백엔드 `joinedload` 최적화)
- [x] **온디맨드 로딩 구현**: 페이지 진입 시 자동 로드 제거 및 [믹서/악보 불러오기] 버튼 도입
- [x] **용어 순화**: 'DB 보관' → **'보관함에 보관'**으로 사용자 친화적 용어 변경
- [x] **베이스 타브 에러 수정**: 4현 악기(Bass) 분석 시 발생하던 `IndexError` 해결 및 동적 헤더 적용
- [x] **데이터 동기화**: 프로젝트 상세 페이지에서 파트별 생성 정보를 리스트로 받아 버튼 상태 정밀 제어

---

## 🎯 우선순위 및 예상 일정

| Phase | 작업 내용 | 우선순위 | 예상 소요 | 의존성 |
|-------|----------|---------|----------|--------|
| Phase 1 | 백엔드 기반 구축 | 🔴 높음 | 2-3일 | 없음 |
| Phase 2 | 프론트엔드 인증 설정 | 🔴 높음 | 2-3일 | Phase 1 완료 |
| Phase 3 | 통합 및 기능 연결 | 🟡 중간 | 2일 | Phase 1, 2 완료 |
| Phase 4 | UI 개선 및 마무리 | 🟡 중간 | 2일 | Phase 3 완료 |
| Phase 5 | 테스트 및 배포 준비 | 🟢 낮음 | 1-2일 | Phase 4 완료 |

**총 예상 소요 기간**: 9-12일

---

## ⚠️ 주의사항 및 리스크

1. **OAuth 자격 증명 관리**: 절대 Git에 커밋하지 말 것 (`.env` 파일을 `.gitignore`에 추가)
2. **토큰 보안**: JWT 시크릿 키는 충분히 복잡하게 생성 (최소 32자)
3. **CORS 설정**: 프로덕션 환경에서는 특정 도메인만 허용
4. **Rate Limiting**: 무차별 대입 공격 방지를 위해 필수
5. **HTTPS**: 프로덕션 배포 시 반드시 HTTPS 사용
6. **데이터 마이그레이션**: 기존 프로젝트 데이터가 있다면 마이그레이션 스크립트 작성 필요
