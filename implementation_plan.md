# 구현 계획서 - Fingerstyle MCP 1단계 (MVP)

이 계획서는 MP3/WAV 파일을 간진한 ASCII 기타 타브 악보로 변환하는 Python 기반 MCP 서버 구축 단계를 설명합니다.

## 1단계: MVP - 단순 오디오-타브 변환

### 1. 환경 설정
- 필요한 라이브러리를 포함한 `requirements.txt` 작성:
    - `mcp`: MCP Python SDK
    - `basic-pitch`: 오디오 전사(Transcription)용 AI 모델
    - `music21`: 음악 이론 처리 및 기타 운지법 계산
    - `librosa`: 오디오 유틸리티
- Python 가상 환경 설정 (권장).

### 2. 핵심 로직 구현
- **오디오 분석 모듈 (`src/transcriber.py`)**:
    - 오디오 파일 로드.
    - Basic Pitch 모델을 실행하여 MIDI와 유사한 노트 이벤트 추출.
- **타브 생성 모듈 (`src/tab_generator.py`)**:
    - 추출된 노트를 MIDI 음정으로 변환.
    - Music21 또는 커스텀 로직을 사용하여 MIDI 음정을 기타 줄/프렛(표준 튜닝)에 매핑.
    - ASCII 형식의 타브 악보 텍스트 생성.

### 3. MCP 서버 개발 (`mcp_server.py`)
- MCP 서버 정의.
- `analyze_audio_to_tab` 도구 구현:
    - 입력: `file_path` (문자열).
    - 로직: 분석 모듈 호출 -> 타브 생성 모듈 호출.
    - 출력: ASCII 타브 문자열 및 처리 상태.

### 4. 검증
- 간단한 멜로디 오디오 파일로 테스트.
- ASCII 출력 형식 확인.

## 2 & 3단계: 고급 기능 (향후 구현)
- 멀티 트랙 지원 (멜로디 + 베이스).
- MCP 도구를 통한 대화형 운지법 수정 기능.
- MusicXML 파일 내보내기.
- 퍼커시브 주법(해머링 온, 풀 오프 등) 인식 도전.
