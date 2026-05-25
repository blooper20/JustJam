# JustJam: Platform Architecture & Source Specifications

This document serves as a unified training source for **NotebookLM**, detailing the core business logic, database schema layout, neural network pipeline mappings, digital signal processing (DSP) workflows, and frontend state synchronization rules of the **JustJam** platform.

---

# 📖 Section 1: Official README

```markdown
# 🎸 JustJam: Band-Mate AI Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.1.2-black.svg)](https://nextjs.org/)

**JustJam** is an AI-powered band practice and music arrangement platform. It runs local neural network models to separate imported audio into individual stems, transcribes notes, detects chord progressions and structure, and provides an interactive multitrack player with a precision metronome for optimal practice.

## ✨ Features

- **🎧 AI Source Separation**: Splits any audio track into multiple stems (Vocals, Drums, Bass, Guitar, Piano, Other) using Demucs v4.
- **🎼 MusicXML Score Generation**: Transcribes stem melodies and chords using Spotify's Basic Pitch and renders interactive sheet music.
- **🎸 Intelligent Tablature Mapper**: Auto-generates guitar and bass ASCII tablatures utilizing an open-position prior, chord-matching constraints, and auto-transposition (Smart Capo) for easy playability.
- **🎛️ Interactive Multitrack Mixer**: Features solo, mute, volume adjustment, and playback speed control powered by WaveSurfer.js.
- **⏱️ Audio-Synced Metronome**: Custom Web Audio API metronome synced precisely to the playback clock with manual TAP BPM overrides.
- **🤝 Collaboration Workspace**: Real-time project sharing and access permission control (Viewer / Editor) for band members.

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 16.1.2 (App Router) & React 19.2.3
- **Styling**: Tailwind CSS v4 & Radix UI / Shadcn
- **Audio Rendering**: WaveSurfer.js 7.12.1 (Multi-waveform synchronization)
- **Score Rendering**: OpenSheetMusicDisplay 1.9.3 (MusicXML renderer)
- **State Management & Data Fetching**: Zustand 5.0.10 & TanStack React Query v5
- **Internationalization**: next-intl 4.8.2 (Supports English & Korean)
- **Authentication**: NextAuth.js 4.24.13

### Backend
- **Framework**: FastAPI 0.128.0 (ASGI Web Framework)
- **Audio Engine & DSP**: 
  - Librosa 0.11.0 (Tempo/BPM tracking, beat grid alignment)
  - Spotify Basic Pitch 0.4.0 (Audio-to-MIDI neural network transcription)
  - Facebook Demucs 4.0.1 (Neural audio source separation)
  - music21 8.3.0 (Harmonic analysis and key detection)
  - PyTorch 2.8.0 & torchaudio 2.8.0 (Model execution engines)
- **Queue & Async Task Workers**: Celery 5.4+ (backed by Redis broker)
- **Database & Migration**: SQLite (local) / PostgreSQL (production) mapped via SQLAlchemy 2.0.25 and managed by Alembic 1.13.1

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+**
- **Node.js 18+**
- **FFmpeg**: Required for audio segmenting and Demucs processing.

### Setup and Running

#### 1. Backend Server Setup
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn src.api.main:app --reload
```

#### 2. Frontend Client Setup
```bash
cd client
npm install
npm run dev
```

## 🏗 Directory Structure (Milestones)
```
JustJam/
├── client/                     # Frontend Next.js Application
│   ├── app/                    # Next.js App Router Pages
│   │   ├── [locale]/           # Localized app views (dashboard, projects, settings)
│   │   └── globals.css         # Tailwind v4 globals & custom styles
│   ├── components/             # Reusable UI Components
│   │   ├── multitrack-player.tsx # Sync-player & Web Audio Metronome Engine
│   │   ├── score-viewer.tsx    # OpenSheetMusicDisplay wrapper
│   │   └── tab-viewer.tsx      # Tablature rendering component
│   ├── hooks/                  # Custom React Hooks
│   │   └── use-project.ts      # Project fetching and polling hook
│   ├── lib/                    # Configuration and API Client helper
│   │   ├── api.ts              # API interface methods
│   └── package.json            # Frontend dependency definitions
├── src/                        # Backend FastAPI Application
│   ├── api/                    # Web API Layer
│   │   ├── database.py         # SQLAlchemy Engine & session pool
│   │   ├── main.py             # FastAPI App definition & Middleware
│   │   ├── models.py           # SQLAlchemy DB Models (User, Project, Asset)
│   │   ├── routes/             # Route controllers (projects, users, auth)
│   │   └── services/           # Orchestration layer (project_service, analysis_service)
│   ├── audio_processor.py      # Demucs source separation wrapper
│   ├── score_generator.py      # MusicXML compilation engine
│   ├── tab_generator.py        # ASCII Tab transcription & fingering optimizer
│   └── transcriber.py          # Basic Pitch wrapper and quantized cleaning
└── README.md                   # This overview document
```
```

---

# 🤖 Section 2: Agent Developer Guidelines

```markdown
# 🤖 AGENTS.md: Developer Guidelines & Code of Conduct

Welcome, Agent. This document outlines the strict engineering guidelines, quality standards, and verification protocols required for all AI sub-agents collaborating on the **JustJam** codebase. Adherence to these rules is non-negotiable.

## 🧭 Core Principles

1. **Self-Correction Prior to Submission**: Do not request human review for issues that can be caught programmatically. Check your work using local verification tools.
2. **No Placeholders**: Never write placeholder functions (`// TODO`, `pass`) or mock endpoints unless explicitly instructed.
3. **Preserve Domain Logic**: Do not degrade the core DSP or transcription heuristics (such as the open-position prior, chord matching, or beat quantization rules) when refactoring audio code.

## 🛠 Coding Standard & Linting

### Backend (Python)
- **Formatting**: `black` is configured for a line length of **100**. Run it with: `black src/ tests/`
- **Import Sorting**: Use `isort` with the black profile: `isort src/ tests/`
- **Linting**: Run `flake8` to catch syntactic anomalies: `flake8 src/ tests/`
- **Static Type Check**: Run `mypy` to verify type hints: `mypy src/`

### Frontend (Next.js & TypeScript)
- **Linting & Rules**: Next.js uses strict ESLint rules. Verify with: `cd client && npm run lint`
- **Formatting**: Format TSX/TS/CSS files via Prettier:
  `cd client && npx prettier --write "app/**/*.{ts,tsx}" "components/**/*.{ts,tsx}"`

## 🧪 Testing Protocol

### Backend Testing
- Run the full pytest suite: `pytest`
- Ensure coverage does not degrade. Run: `pytest --cov=src tests/`

### Frontend Testing
- **Unit & Integration**: Run Jest tests: `cd client && npm run test`
- **End-to-End (E2E)**: Run Playwright tests: `cd client && npx playwright test`

## 📦 Build Verification
```bash
cd client
npm run build
```
Any hydration warnings, React v19 deprecations, or TypeScript compiler errors in the build log will result in an immediate rejection.
```

---

# 💻 Section 3: Backend Architecture & Core Code

## 3.1 SQLAlchemy Schema Definitions (`src/api/models.py`)

This file outlines the database schemas for social users, collaborative projects, shared memberships, and compiled assets (tabs/MusicXML scores).

```python
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from src.api.database import Base

class User(Base):
    """사용자 모델 - 소셜 로그인 (Google, Kakao) 지원"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    nickname = Column(String, nullable=True)
    profile_image = Column(String, nullable=True)
    provider = Column(String, nullable=False)  # 'google' or 'kakao'
    provider_id = Column(String, nullable=False)  # OAuth provider's unique ID
    role = Column(String, default="user")  # 'user' or 'admin'
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    projects = relationship("ProjectModel", back_populates="owner", cascade="all, delete-orphan")
    shared_projects = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (Index("idx_provider_id", "provider", "provider_id"),)

class ProjectMember(Base):
    """프로젝트 협업 멤버 모델 - 특정 프로젝트를 공유받은 사용자"""
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String, default="viewer")  # 'viewer' or 'editor'
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("ProjectModel", back_populates="members")
    user = relationship("User", back_populates="shared_projects")

class ProjectModel(Base):
    """프로젝트 모델 - 사용자별 음악 프로젝트"""
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    original_filename = Column(String)
    status = Column(String, default="pending")
    progress = Column(Integer, default=0)
    bpm = Column(Integer, nullable=True)
    detected_key = Column(String, nullable=True)
    chord_progression = Column(String, nullable=True)  # JSON formatted string
    structure = Column(String, nullable=True)  # JSON formatted string
    thumbnail_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    owner = relationship("User", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    assets = relationship("ProjectAsset", back_populates="project", cascade="all, delete-orphan")

class ProjectAsset(Base):
    """프로젝트 결과물 (악보, 타브 등) 저장 모델"""
    __tablename__ = "project_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.id"), index=True)
    asset_type = Column(String)  # 'score', 'tab'
    instrument = Column(String)  # 'vocals', 'guitar', 'bass', etc.
    content = Column(String)  # XML string for score, ASCII for tab
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("ProjectModel", back_populates="assets")
```

---

## 3.2 Projects Controller Endpoint Routes (`src/api/routes/projects.py`)

This file exposes the routing operations for managing project uploads, starting source separation workers, fetching stems, compiling midi/tabs, and collaboration controls.

```python
from fastapi import APIRouter, BackgroundTasks, Depends, File, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi_cache.decorator import cache
from sqlalchemy.orm import Session
from typing import List, Optional
from src.api.database import get_db
from src.api.dependencies import get_current_user, get_optional_current_user
from src.api.models import User
from src.api.schemas.project import Project, ProjectMember as ProjectMemberSchema, ProjectShareRequest, ProjectUpdate, StemFiles, MixRequest
from src.api.services.project_service import ProjectService, generate_thumbnail

router = APIRouter()

@router.post("/", summary="새 프로젝트 생성")
async def create_project(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project, file_path = ProjectService.create_project(db, file.filename, file.file, current_user)
    from src.api.services.project_service import UPLOAD_DIR
    import os
    thumbnail_filename = f"thumb_{project.id}.png"
    thumbnail_path = os.path.join(UPLOAD_DIR, thumbnail_filename)
    background_tasks.add_task(generate_thumbnail, file_path, thumbnail_path)
    project.thumbnail_url = f"/static/uploads/{thumbnail_filename}"
    db.commit()
    return project

@router.post("/{project_id}/process", summary="음원 분리 시작")
async def process_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    from src.api.services.project_service import process_audio_task, process_audio_logic
    from src.api.models import ProjectModel
    from src.api.schemas.project import TaskStatus
    
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.status = TaskStatus.PROCESSING.value
    project.progress = 0
    db.commit()

    try:
        process_audio_task.apply_async(args=[project_id], connect_timeout=1)
        return {"message": "Processing started via Celery", "status": "processing"}
    except Exception as e:
        from src.api.logging_config import logger
        logger.warning(f"Celery start failed (Redis down?), using BackgroundTasks: {e}")
        background_tasks.add_task(process_audio_logic, project_id)
        return {"message": "Processing started via BackgroundTasks", "status": "processing"}

@router.get("/{project_id}", response_model=Project)
@cache(expire=300)
async def get_project(project_id: str, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    return ProjectService.get_project(db, project_id, current_user)

@router.get("/", response_model=List[Project])
@cache(expire=60)
async def list_projects(q: Optional[str] = None, sort: str = "newest", skip: int = 0, limit: int = 50, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    return ProjectService.list_projects(db, current_user, q, sort, skip, limit)

@router.get("/{project_id}/stems", response_model=StemFiles)
async def get_project_stems(project_id: str, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    return ProjectService.get_project_stems(db, project_id, current_user)

@router.post("/{project_id}/score/{instrument}")
async def generate_project_score(project_id: str, instrument: str, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    content, cached = ProjectService.generate_score(db, project_id, instrument, current_user)
    headers = {"X-Cache": "HIT"} if cached else {}
    return Response(content=content, media_type="application/xml", headers=headers)

@router.post("/{project_id}/tabs/{instrument}")
async def generate_project_tab(project_id: str, instrument: str, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    result, cached = ProjectService.generate_tab(db, project_id, instrument, current_user)
    headers = {"X-Cache": "HIT"} if cached else {}
    return JSONResponse(content=result, headers=headers)

@router.post("/{project_id}/mix")
async def mix_audio(project_id: str, request: MixRequest, current_user: Optional[User] = Depends(get_optional_current_user), db: Session = Depends(get_db)) -> dict:
    url = ProjectService.mix_audio(db, project_id, request, current_user)
    return {"url": url}
```

---

## 3.3 Audio Processing & Project Orchestration Service (`src/api/services/project_service.py`)

This contains the core orchestration layer calling Demucs source separation, Librosa BPM tracking, structural chord alignment, and stem overlay mixer.

```python
# Key excerpt from project_service.py showing async audio separation and custom stem overlay mixer

def process_audio_logic(project_id: str, celery_self=None):
    """음원 분리 작업의 핵심 로직 (Celery와 BackgroundTasks 공통)"""
    db = SessionLocal()
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project: return

        project.status = TaskStatus.PROCESSING.value
        db.commit()
        input_path = os.path.join(UPLOAD_DIR, project.original_filename)

        def update_progress(percent: int):
            scaled_req = min(int(percent * 0.95), 99)
            try:
                project.progress = scaled_req
                db.commit()
                if celery_self:
                    celery_self.update_state(state="PROGRESS", meta={"percent": scaled_req})
            except Exception as e:
                logger.error(f"Error updating progress: {e}")
                db.rollback()

        # Step 1: Facebook Demucs audio separation (6-stem model)
        stems = separate_audio(input_path, model_name="htdemucs_6s", progress_callback=update_progress)
        
        # Step 2: Librosa beat track for BPM detection
        try:
            stem_dir = os.path.join(SEPARATED_DIR, "htdemucs_6s", project_id)
            drums_path = os.path.join(stem_dir, "drums.wav")
            target_path = drums_path if os.path.exists(drums_path) else input_path

            y, sr = librosa.load(target_path, sr=None, duration=60)
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            detected_bpm = int(round(tempo)) if isinstance(tempo, float) else int(round(tempo[0]))
            project.bpm = detected_bpm
        except Exception as e:
            logger.error(f"BPM Detection failed: {e}")

        # Step 3: Overlaying separated wav files into master.wav
        try:
            stem_dir = os.path.join(SEPARATED_DIR, "htdemucs_6s", project_id)
            master = None
            for stem in ["vocals", "drums", "bass", "guitar", "piano", "other"]:
                stem_path = os.path.join(stem_dir, f"{stem}.wav")
                if os.path.exists(stem_path):
                    audio = AudioSegment.from_wav(stem_path)
                    if master is None: master = audio
                    else: master = master.overlay(audio)
            if master:
                master.export(os.path.join(stem_dir, "master.wav"), format="wav")
        except Exception as e:
            logger.error(f"Master mix generation failed: {e}")

        # Step 4: Analytical key, chord progression, and structures
        try:
            from src.api.services.analysis_service import perform_full_analysis
            analysis_results = perform_full_analysis(input_path, float(project.bpm or 120.0))
            project.detected_key = analysis_results.get("key")
            project.chord_progression = json.dumps(analysis_results.get("chords"))
            project.structure = json.dumps(analysis_results.get("structure"))
        except Exception as e:
            logger.error(f"Analysis failed: {e}")

        if stems and "original" not in stems:
            project.status = TaskStatus.COMPLETED.value
            project.progress = 100
        else:
            project.status = TaskStatus.FAILED.value
        db.commit()
    except Exception as e:
        project.status = TaskStatus.FAILED.value
        db.commit()
    finally:
        db.close()
```

---

## 3.4 DSP Transcription & Chunk Processing (`src/transcriber.py`)

Processes audio using Spotify's Basic Pitch ML model, quantizes onset timings to 16th-note grids, and constrains chord polyphony (maximum 3 simultaneous notes) to ensure tabs are physically playable.

```python
# Key DSP algorithms from transcriber.py

def transcribe_audio(
    audio_path: str, duration: float = None, start_offset: float = 0.0, target_stem: str = None
) -> Tuple[List[Dict[str, Any]], float]:
    validated_path = validate_audio_file(audio_path)
    audio_path_str = str(validated_path)

    # Source Separation
    stems = separate_audio(audio_path_str)

    # Detect BPM
    bpm_source = stems.get("drums", stems.get("original", stems.get("bass", audio_path_str)))
    bpm_detect_duration = min(60, duration if duration else 60)
    y, sr = librosa.load(bpm_source, offset=start_offset, duration=bpm_detect_duration)
    tempo, __ = librosa.beat.beat_track(y=y, sr=sr)
    detected_bpm = float(tempo)

    all_notes = []

    def process_stem(path: str, role: str) -> List[Dict[str, Any]]:
        if not os.path.exists(path): return []
        s_dur = float(librosa.get_duration(path=path))
        if duration: s_dur = min(s_dur, duration)
        
        # Parallel chunking threshold configuration
        parallel_threshold = config.get("audio", "parallel_threshold", 45.0)
        stem_notes = []
        if s_dur < parallel_threshold:
            stem_notes = _transcribe_chunk(path, duration=s_dur, start_offset=start_offset)
        else:
            # Split audio into parallel overlapping threads
            chunk_size = config.get("audio", "chunk_size", 30.0)
            overlap = config.get("audio", "chunk_overlap", 2.0)
            chunks = []
            curr = start_offset
            end_t = start_offset + s_dur
            while curr < end_t:
                d = min(chunk_size + overlap, end_t - curr)
                chunks.append((curr, d))
                if curr + chunk_size >= end_t: break
                curr += chunk_size

            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = [executor.submit(_transcribe_chunk, path, d, s) for s, d in chunks]
                for f in futures:
                    try: stem_notes.extend(f.result())
                    except: pass
        for n in stem_notes:
            n["role"] = role
        return stem_notes

    # Distribute stem roles: Melody (vocals), Bass (bass), Harmony (guitar/piano/other)
    if "vocals" in stems:
        if target_stem:
            role_map = {"vocals": "melody", "bass": "bass", "guitar": "harmony", "piano": "harmony", "other": "harmony"}
            stem_path = stems.get(target_stem)
            if not stem_path and target_stem == "guitar" and "other" in stems:
                stem_path = stems["other"]
            if stem_path:
                all_notes = process_stem(stem_path, role_map.get(target_stem, "harmony"))
        else:
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=3) as executor:
                futures = []
                if "vocals" in stems: futures.append(executor.submit(process_stem, stems["vocals"], "melody"))
                if "bass" in stems: futures.append(executor.submit(process_stem, stems["bass"], "bass"))
                
                harmony_stems = [stems[k] for k in ["guitar", "piano", "other"] if k in stems]
                for h_stem in harmony_stems:
                    futures.append(executor.submit(process_stem, h_stem, "harmony"))
                for f in futures:
                    try: all_notes.extend(f.result())
                    except: pass
    else:
        all_notes = process_stem(stems["original"], "harmony")

    # Clean & Quantize note events
    def _clean_and_quantize(notes: List[Dict[str, Any]], bpm: float) -> List[Dict[str, Any]]:
        min_vel = config.get("post_processing", "min_velocity", 0.3)
        min_dur = config.get("post_processing", "min_note_duration", 0.1)
        do_quantize = config.get("post_processing", "quantize", True)
        beat_dur = 60.0 / bpm
        sixteenth_dur = beat_dur / 4.0

        cleaned = []
        max_poly = config.get("post_processing", "max_polyphony", 3)

        for n in notes:
            if n["velocity"] < min_vel or (n["end"] - n["start"]) < min_dur: continue
            new_n = n.copy()
            if do_quantize:
                grid_idx = round(n["start"] / sixteenth_dur)
                new_n["start"] = grid_idx * sixteenth_dur
                new_n["end"] = max(new_n["start"] + sixteenth_dur, n["end"])
            cleaned.append(new_n)

        # Group by onset
        time_groups = {}
        for n in cleaned:
            t = int(n["start"] * 100)
            time_groups.setdefault(t, []).append(n)

        final_notes = []
        for t, group in time_groups.items():
            pitch_map = {}
            for n in group:
                if n["pitch"] not in pitch_map or n["velocity"] > pitch_map[n["pitch"]]["velocity"]:
                    pitch_map[n["pitch"]] = n
            unique_in_group = sorted(pitch_map.values(), key=lambda x: x["pitch"])

            # Strict Polyphony Limiter: Keeps melody (highest), bass (lowest) and loudest harmony
            if len(unique_in_group) > max_poly:
                melody = unique_in_group[-1]
                bass = unique_in_group[0]
                others = sorted(unique_in_group[1:-1], key=lambda x: -x["velocity"])
                keep_others = others[:max(0, max_poly - 2)]
                
                limited_group = [bass] + keep_others + [melody]
                unique_in_group = []
                seen_p = set()
                for n in limited_group:
                    if n["pitch"] not in seen_p:
                        unique_in_group.append(n)
                        seen_p.add(n["pitch"])
            final_notes.extend(unique_in_group)

        return sorted(final_notes, key=lambda x: x["start"])

    unique_notes = _clean_and_quantize(all_notes, detected_bpm)
    return unique_notes, detected_bpm
```

---

## 3.5 Tablature Generation & Fingering Optimizations (`src/tab_generator.py`)

Converts transcribed midi numbers into fret/string mapping. Features auto-transposition to guitar-friendly keys (C, G, D, A, E) and prefers open positions (0-3 frets).

```python
# Fretboard routing algorithm from tab_generator.py

class TabGenerator:
    # (templates initialized in constructor for C, Cm, D, Dm, E, Em, etc.)

    def _auto_transpose(self, notes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """음원의 대표 근음을 추출하여 기타 연주가 쉬운 개방현 키(C, G, D, A, E)로 변환"""
        if not notes: return notes
        chroma = [0] * 12
        for n in notes: chroma[n["pitch"] % 12] += 1
        detected_root = chroma.index(max(chroma))
        friendly_roots = [0, 2, 4, 7, 9]  # C, D, E, G, A
        
        best_shift = 0
        min_dist = 999
        for fr in friendly_roots:
            diff = (fr - detected_root + 6) % 12 - 6
            if abs(diff) < abs(min_dist):
                min_dist = diff
                best_shift = diff

        if best_shift != 0:
            for n in notes: n["pitch"] += best_shift
        return notes

    def find_best_pos(
        self, midi_pitch: int, is_bass: bool = False, chord_shape: Optional[Dict[int, int]] = None, role: str = "harmony"
    ) -> Optional[Tuple[int, int]]:
        """역할 및 코드 형상을 기반으로 최적의 줄(String)과 프렛(Fret) 위치 점수화"""
        best_cand = None
        max_score = -float("inf")
        shifts = [0, -12, 12]
        if role == "bass": shifts = [0, -12, -24]
        if role == "melody": shifts = [0, 12, -12]

        for octave_shift in shifts:
            shifted_pitch = midi_pitch + octave_shift
            for s_idx in range(self.num_strings):
                fret = shifted_pitch - self.tuning[s_idx]
                max_fret = getattr(self, "config_max_fret", 15)

                if 0 <= fret <= max_fret:
                    score = 0
                    # 1. Open Fret Preference
                    if fret == 0: score += 3000
                    elif fret <= 3: score += 1500
                    elif fret <= 5: score += 500
                    else: score -= fret * 100

                    # 2. String Preference by Role
                    if role == "melody":
                        if s_idx >= 3: score += 500
                        if s_idx <= 1: score -= 1000
                    elif role == "bass" or is_bass:
                        if s_idx <= 2: score += 500
                        if s_idx >= 4: score -= 1000

                    # 3. Chord Constraint matching
                    if chord_shape and s_idx in chord_shape and chord_shape[s_idx] == fret:
                        score += 2000

                    if score > max_score:
                        max_score = score
                        best_cand = (s_idx, fret)
            if best_cand and max_score > 2000: break
        return best_cand

    def generate_ascii_tab(self, notes: List[Dict[str, Any]]) -> str:
        if not notes: return "No notes detected."
        if config.get("tablature", "auto_transpose", True):
            notes = self._auto_transpose(notes)

        slots_per_measure = config.get("tablature", "slots_per_measure", 16)
        sec_per_measure = (60 / self.bpm) * 4
        max_time = max(n["end"] for n in notes)
        num_measures = int(max_time / sec_per_measure) + 1

        full_tab = [[["-" for _ in range(slots_per_measure)] for _ in range(num_measures)] for _ in range(self.num_strings)]
        measure_chords = ["N.C." for _ in range(num_measures)]

        for m_idx in range(num_measures):
            m_notes = [n for n in notes if int(n["start"] / sec_per_measure) == m_idx]
            measure_chords[m_idx] = self.detect_chord(m_notes)

        for n in notes:
            m_idx = int(n["start"] / sec_per_measure)
            if m_idx >= num_measures: continue
            
            chord_name = measure_chords[m_idx]
            current_shape = self.chord_templates.get(chord_name, {})
            role = n.get("role", "harmony")

            # Snap harmony note to active chord context
            snap_to_chord = config.get("post_processing", "snap_harmony_to_key", True)
            if snap_to_chord and role == "harmony" and chord_name != "N.C." and current_shape:
                allowable_pcs = {(self.tuning[s] + f) % 12 for s, f in current_shape.items() if s < self.num_strings}
                if (n["pitch"] % 12) not in allowable_pcs: continue

            is_bass = (role == "bass") or (n["pitch"] <= self.bass_threshold)
            pos = self.find_best_pos(n["pitch"], is_bass=is_bass, chord_shape=current_shape, role=role)

            if pos:
                s_idx, fret = pos
                rel_time = n["start"] % sec_per_measure
                slot_idx = int((rel_time / sec_per_measure) * slots_per_measure)
                line_idx = self.num_strings - 1 - s_idx

                fret_str = str(fret)
                for i, c in enumerate(fret_str):
                    write_idx = slot_idx + i
                    if write_idx < slots_per_measure:
                        # Collision check
                        if full_tab[line_idx][m_idx][write_idx] != "-": continue
                        # Fast strum prevention (Previous 16th check)
                        if write_idx > 0 and full_tab[line_idx][m_idx][write_idx - 1] != "-": continue
                        full_tab[line_idx][m_idx][write_idx] = c

        return self._render_layout(full_tab, measure_chords, num_measures, slots_per_measure)
```

---

# 🖥 Section 4: Frontend Architecture & Core Code

## 4.1 API Interface & Schema Contracts (`client/lib/api.ts`)

Defines data shape interfaces for Client-Server communications and wraps backend endpoints.

```typescript
import apiClient from './api-client';

export interface User {
  id: number;
  email: string;
  nickname: string | null;
  profile_image: string | null;
  provider: string;
  role: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  user_id: number;
  project_id: string;
  role: 'viewer' | 'editor';
  email: string;
  nickname: string;
}

export interface Project {
  id: string;
  name: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  progress: number;
  bpm?: number;
  has_score?: boolean;
  has_tab?: boolean;
  score_instruments?: string[];
  tab_instruments?: string[];
  members?: ProjectMember[];
  is_owner?: boolean;
  thumbnail_url?: string;
  detected_key?: string;
  chord_progression?: string;
  structure?: string;
}

export interface StemFiles {
  vocals: string | null;
  bass: string | null;
  drums: string | null;
  guitar: string | null;
  piano: string | null;
  other: string | null;
  master: string | null;
}

export interface TabResponse {
  project_id: string;
  instrument: string;
  bpm: number;
  tab: string;
  notes_count: number;
}

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const fetchProjects = async (params?: { q?: string; sort?: string }): Promise<Project[]> => {
  const response = await apiClient.get('/projects/', { params });
  return response.data;
};

export const fetchProject = async (id: string): Promise<Project> => {
  const response = await apiClient.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (file: File): Promise<Project> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/projects/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const processProject = async (id: string): Promise<Project> => {
  const response = await apiClient.post(`/projects/${id}/process`);
  return response.data;
};

export const fetchProjectStems = async (id: string): Promise<StemFiles> => {
  const response = await apiClient.get(`/projects/${id}/stems`);
  const data = response.data;
  const fixUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${SERVER_URL}${url}`;
  };
  return {
    vocals: fixUrl(data.vocals),
    bass: fixUrl(data.bass),
    drums: fixUrl(data.drums),
    guitar: fixUrl(data.guitar),
    piano: fixUrl(data.piano),
    other: fixUrl(data.other),
    master: fixUrl(data.master),
  };
};

export const generateTab = async (id: string, instrument: string): Promise<TabResponse> => {
  const response = await apiClient.post(`/projects/${id}/tabs/${instrument}`);
  return response.data;
};
```

---

## 4.2 Localized Project State Controller Hooks (`client/hooks/use-project.ts`)

Hooks using TanStack Query to manage single project synchronization and poll status at 1-second intervals during processing.

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProject, processProject, fetchProjectStems } from '@/lib/api';

export function useProject(id: string) {
    const queryClient = useQueryClient();

    const projectQuery = useQuery({
        queryKey: ['project', id],
        queryFn: () => fetchProject(id),
        // Poll backend progress every 1s when audio separation task is processing
        refetchInterval: (query) => (query.state.data?.status === 'processing' ? 1000 : false),
    });

    const stemsQuery = useQuery({
        queryKey: ['project', id, 'stems'],
        queryFn: () => fetchProjectStems(id),
        enabled: projectQuery.data?.status === 'completed',
    });

    const processMutation = useMutation({
        mutationFn: () => processProject(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
        },
    });

    return {
        project: projectQuery.data,
        isLoading: projectQuery.isLoading,
        error: projectQuery.error,
        stems: stemsQuery.data,
        isLoadingStems: stemsQuery.isLoading,
        processProject: processMutation.mutate,
        isProcessing: processMutation.isPending,
    };
}
```

---

## 4.3 Multi-Track Sync & Metronome Engine (`client/components/multitrack-player.tsx`)

Binds separated stem player layers via WaveSurfer.js and drives a high-precision metronome with drift compensation using the Web Audio API.

```typescript
// Excerpt from multitrack-player.tsx showing Metronome Engine and WaveSurfer init

class MetronomeEngine {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private strongBuffer: AudioBuffer | null = null;
  private weakBuffer: AudioBuffer | null = null;
  private isRunning = false;
  private animationFrameId: number | null = null;
  
  private scheduleAheadTime = 0.05; // 50ms scheduling ahead buffer
  private bpm = 120;
  private startOffset = 0;
  private volume = 1.0;
  private lastScheduledBeatIndex = -1;
  private lastBeatTime = 0;
  private getPlaybackTime: (() => number) | null = null;
  
  onBeat: ((beatIndex: number) => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.connect(audioContext.destination);
    this.createClickBuffers();
  }

  private createClickBuffers() {
    const sampleRate = this.audioContext.sampleRate;
    // Generate Downbeat Buffer (tick)
    const strongDuration = 0.03;
    const strongSamples = Math.floor(sampleRate * strongDuration);
    const strongBuffer = this.audioContext.createBuffer(1, strongSamples, sampleRate);
    const strongData = strongBuffer.getChannelData(0);
    for (let i = 0; i < strongSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 60);
      strongData[i] = (Math.sin(2 * Math.PI * 1000 * t) + Math.sin(2 * Math.PI * 2000 * t) * 0.3) * envelope * 0.7;
    }
    // Generate Offbeat Buffer (tock)
    const weakDuration = 0.025;
    const weakSamples = Math.floor(sampleRate * weakDuration);
    const weakBuffer = this.audioContext.createBuffer(1, weakSamples, sampleRate);
    const weakData = weakBuffer.getChannelData(0);
    for (let i = 0; i < weakSamples; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 80);
      weakData[i] = Math.sin(2 * Math.PI * 800 * t) * envelope * 0.45;
    }
    this.strongBuffer = strongBuffer;
    this.weakBuffer = weakBuffer;
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(30, Math.min(300, bpm));
    if (this.isRunning) this.resetBeatTracking();
  }

  setStartOffset(offset: number) {
    this.startOffset = Math.max(0, offset);
    if (this.isRunning) this.resetBeatTracking();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
  }

  setTimeSource(fn: () => number) { this.getPlaybackTime = fn; }

  private resetBeatTracking() {
    if (this.getPlaybackTime) {
      const currentTime = this.getPlaybackTime();
      if (currentTime >= this.startOffset) {
        const timeSinceStart = currentTime - this.startOffset;
        const beatInterval = 60.0 / this.bpm;
        this.lastScheduledBeatIndex = Math.floor(timeSinceStart / beatInterval);
      } else {
        this.lastScheduledBeatIndex = -1;
      }
    }
  }

  private playClick(isStrong: boolean, scheduledTime?: number) {
    if (!this.strongBuffer || !this.weakBuffer) return;
    const source = this.audioContext.createBufferSource();
    source.buffer = isStrong ? this.strongBuffer : this.weakBuffer;
    source.connect(this.gainNode);
    if (scheduledTime !== undefined && scheduledTime > this.audioContext.currentTime) {
      source.start(scheduledTime);
    } else {
      source.start();
    }
  }

  // RequestAnimationFrame tick loop to schedule clicks synced to WaveSurfer play clock
  private tick = () => {
    if (!this.isRunning || !this.getPlaybackTime) return;
    const currentPlaybackTime = this.getPlaybackTime();
    const beatInterval = 60.0 / this.bpm;

    if (currentPlaybackTime >= this.startOffset) {
      const timeSinceStart = currentPlaybackTime - this.startOffset;
      const currentBeatIndex = Math.floor(timeSinceStart / beatInterval);

      if (currentBeatIndex > this.lastScheduledBeatIndex) {
        const beatToPlay = currentBeatIndex;
        const isStrong = beatToPlay % 4 === 0;
        this.playClick(isStrong);
        if (this.onBeat) this.onBeat(beatToPlay % 4);
        this.lastScheduledBeatIndex = beatToPlay;
        this.lastBeatTime = currentPlaybackTime;
      }
    } else {
      if (this.lastScheduledBeatIndex !== -1) {
        this.lastScheduledBeatIndex = -1;
        if (this.onBeat) this.onBeat(-1);
      }
    }
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.resetBeatTracking();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastScheduledBeatIndex = -1;
    if (this.onBeat) this.onBeat(-1);
  }
}
