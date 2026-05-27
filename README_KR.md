# 🎸 JustJam: Band-Mate AI Platform (한글 사양서)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.1.2-black.svg)](https://nextjs.org/)

**JustJam**은 AI 기술을 기반으로 하는 스마트 밴드 연습 및 편곡 협업 플랫폼입니다. 로컬 딥러닝 모델을 활용하여 사용자가 업로드한 음원을 개별 트랙(Stem)으로 분리하고, 멜로디 및 코드 악보를 전사하며, 연주가 용이한 타브(Tab) 악보를 자동으로 생성해 줍니다. 또한, WaveSurfer.js를 기반으로 한 멀티트랙 믹서와 Web Audio API 기반의 정밀 메트로놈을 결합하여 최상의 연습 환경을 제공합니다.

[English Document](./README.md) | [한국어 문서](./README_KR.md)

---

## ✨ 6대 핵심 기능 (Features)

### 1. 🎧 AI 기반 음원 분리 (Source Separation)
- **Facebook Demucs v4 (htdemucs_6s)** 모델을 탑재하여 임포트된 단일 음원 파일을 여러 개의 개별 트랙(보컬, 드럼, 베이스, 기타, 피아노, 기타 악기 등)으로 정밀하게 실시간 분리합니다.
- 분리된 음원은 각각의 파트별 연습용 스템(Stem) 파일로 즉시 사용 가능합니다.

### 2. 🎼 MusicXML 악보 자동 생성 (MusicXML Transcription)
- **Spotify Basic Pitch** 딥러닝 모델을 활용하여 각 오디오 트랙의 멜로디와 코드를 고정밀도로 추출하고 전사합니다.
- 추출된 음정(MIDI) 데이터를 기반으로 **OpenSheetMusicDisplay(OSMD)**로 렌더링 가능한 대화형 MusicXML 악보를 생성합니다.

### 3. 🎸 지능형 타브(Tab) 악보 매퍼 (Intelligent Tablature Mapper)
- 수집된 MIDI 음정 데이터를 기타 및 베이스 지판 위로 배치하는 커스텀 운지 최적화 엔진을 탑재하였습니다.
- **개방현 우선 배치 알고리즘**과 연주가 까다로운 키를 개방현 활용이 쉬운 키(C, G, D, A, E)로 변환해 주는 **자동 조바꿈(Auto-Transpose / Smart Capo)** 기능을 지원합니다.
- 최대 동시 발음 수 제한(3음 제한) 및 빠른 속도에서의 아르페지오 방지(Strum Collision 체크) 알고리즘을 통해 실제 연주 가능한 "깔끔한 ASCII 타브 악보"를 제공합니다.

### 4. 🎛️ 인터랙티브 멀티트랙 믹서 (Multitrack Mixer)
- **WaveSurfer.js** 엔진을 활용하여 분리된 멀티트랙 웨이브폼(Waveform)을 브라우저 상에서 시각화하고 완전 동기화된 재생을 제공합니다.
- 각 트랙별 개별 볼륨 조절, 솔로(Solo) 및 음소거(Mute) 기능, 그리고 음질 저하를 최소화한 배속(BPM) 조절이 가능합니다.

### 5. ⏱️ 정밀 오디오 동기화 메트로놈 (Audio-Synced Metronome)
- **Web Audio API** 기반의 룩어헤드(Look-ahead) 스케줄링 기법을 도입하여, 오디오 재생 시계와 완전히 일치하고 시간 드리프트(Drift)가 보정된 초정밀 메트로놈 엔진을 구동합니다.
- 재생 중인 음원의 리듬 그리드와 동기화되며, 수동 탭 템포(TAP BPM) 기능을 통해 유연하게 템포를 조정할 수 있습니다.

### 6. 🤝 실시간 협업 워크스페이스 (Collaboration Workspace)
- 밴드 멤버 간의 실시간 프로젝트 공유 및 권한 관리 시스템을 제공합니다.
- 각 구성원의 역할에 따라 뷰어(Viewer) 및 에디터(Editor) 권한을 세분화하여 협업 편곡 및 연습 기록을 동기화합니다.

---

## 🛠 기술 스택 (Tech Stack)

### Frontend (프론트엔드)
- **Framework**: Next.js 16.1.2 (App Router) & React 19.2.3
- **Styling**: Tailwind CSS v4 & Radix UI / Shadcn UI
- **Audio Rendering**: WaveSurfer.js 7.12.1
- **Score Rendering**: OpenSheetMusicDisplay 1.9.3 (MusicXML Renderer)
- **State Management & Fetching**: Zustand 5.0.10 & TanStack React Query v5
- **Internationalization (i18n)**: next-intl 4.8.2 (한국어 및 영어 대응)
- **Authentication**: NextAuth.js 4.24.13

### Backend (백엔드)
- **Framework**: FastAPI 0.128.0 (ASGI 웹 프레임워크)
- **Audio Engine & DSP**:
  - Librosa 0.11.0 (BPM 템포 감지 및 비트 그리드 정렬)
  - Spotify Basic Pitch 0.4.0 (Audio-to-MIDI 오디오 전사 신경망)
  - Facebook Demucs 4.0.1 (신경망 기반 음원 분리 엔진)
  - music21 8.3.0 (화성 분석 및 키 감지)
  - PyTorch 2.8.0 & torchaudio 2.8.0 (딥러닝 모델 추론 엔진)
- **Queue & Workers**: Celery 5.4+ (Redis Message Broker 기반 비동기 큐 처리)
- **Database & ORM**: SQLite (로컬 개발용) / PostgreSQL (프로덕션용) & SQLAlchemy 2.0.25
- **DB Migration**: Alembic 1.13.1

---

## 🚀 시작하기 (Getting Started)

### 필수 요구사항
설치 및 실행에 앞서 시스템에 다음 프로그램이 준비되어 있어야 합니다.
- **Python 3.10 이상**: [Python 공식 웹사이트](https://www.python.org/downloads/)
- **Node.js 18 이상**: [Node.js 공식 웹사이트](https://nodejs.org/)
- **FFmpeg**: 오디오 파싱, 병렬 슬라이싱 및 Demucs 분리 처리에 필수적입니다.
  - **macOS**: `brew install ffmpeg`
  - **Ubuntu**: `sudo apt-get install ffmpeg`
  - **Windows**: [FFmpeg 다운로드 페이지](https://ffmpeg.org/download.html)에서 다운로드 후 PATH 환경변수 등록.

---

### 로컬 실행 방법 (Execution Guide)

#### 1. Backend 백엔드 서버 설정 및 실행
```bash
# 가상환경 생성 및 활성화
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 패키지 의존성 설치
pip install -r requirements.txt

# 데이터베이스 마이그레이션 적용
alembic upgrade head

# FastAPI 개발 서버 가동 (포트: 8000)
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Celery & Redis 비동기 워커 실행 (음원 분리 처리용)
음원 분리 태스크 처리를 위해 Redis와 Celery 워커가 필요합니다. 로컬에 Redis가 구동 중인 상태여야 합니다.
```bash
# Celery 비동기 워커 실행
celery -A src.api.services.project_service.celery_app worker --loglevel=info --concurrency=1
```

#### 3. Frontend 프론트엔드 클라이언트 실행
```bash
# client 디렉토리 이동
cd client

# 의존성 설치
npm install

# Next.js 로컬 개발 서버 실행 (포트: 3000)
npm run dev
```

---

## 🏗 디렉토리 구조 (Directory Structure)

```
JustJam/
├── client/                     # Next.js 프론트엔드 애플리케이션
│   ├── app/                    # Next.js App Router (App 디렉토리 구조)
│   │   ├── [locale]/           # 다국어 라우팅 (대시보드, 프로젝트 상세, 설정 등)
│   │   └── globals.css         # Tailwind v4 전역 스타일 정의
│   ├── components/             # 재사용 가능한 UI 컴포넌트
│   │   ├── multitrack-player.tsx # WaveSurfer 멀티믹서 및 Web Audio 메트로놈
│   │   ├── score-viewer.tsx    # MusicXML 악보 렌더러
│   │   └── tab-viewer.tsx      # 아스키 타브 악보 뷰어
│   ├── hooks/                  # 리액트 커스텀 훅
│   │   └── use-project.ts      # Zustand와 결합된 1초 주기 상태 폴링 API 훅
│   └── package.json            # 프론트엔드 패키지 명세
├── src/                        # FastAPI 백엔드 애플리케이션
│   ├── api/                    # API 엔드포인트 및 컨트롤러 레이어
│   │   ├── database.py         # DB 세션 커넥션 풀 및 엔진 설정
│   │   ├── main.py             # FastAPI 진입점 및 CORS/미들웨어 설정
│   │   ├── models.py           # SQLAlchemy 데이터베이스 모델
│   │   ├── routes/             # 도메인별 API 라우트 컨트롤러 (projects, auth 등)
│   │   └── services/           # 비동기 오디오 처리 및 핵심 비즈니스 로직 서비스
│   ├── audio_processor.py      # Demucs v4 음원 분리 래퍼 클래스
│   ├── score_generator.py      # MusicXML 변환 및 생성 엔진
│   ├── tab_generator.py        # 스마트 타브(Tab) 지판 운지 최적화 알고리즘
│   └── transcriber.py          # Basic Pitch 멜로디 추출 및 16분음표 퀀타이즈
└── README_KR.md                # 한국어 사양 통합 문서 (본 문서)
```

---

## 🤝 기여하기 (Contributing)
기여를 원하시거나 코드를 수정하고자 할 때는 프로젝트의 엄격한 린터 및 테스트 정합성을 준수해 주셔야 합니다. 자세한 가이드라인은 [CONTRIBUTING.md](./CONTRIBUTING.md) 및 [AGENTS.md](./AGENTS.md)를 참조하십시오.
- **Python Formatting**: `black -l 100 src/ tests/` & `flake8 src/ tests/` 통과 필수.
- **TypeScript & React**: `cd client && npm run lint` 및 `npm run build` 성공 필수.
