# 🎸 핑거스타일 타브 MCP 서버

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

AI 기술을 활용하여 기타 연주 오디오를 고품질 핑거스타일 타브 악보로 자동 변환해주는 MCP (Model Context Protocol) 서버입니다. 최신 딥러닝 모델로 기타 연주를 분석하고, 사용자의 로컬 컴퓨터에서 안전하게 실행되며 타브 악보를 생성합니다.

[한국어 문서](./README_KR.md) | [English](./README.md)

## ✨ 주요 기능

- **🎧 음원 분리 (Source Separation)**: Demucs를 활용해 멜로디, 베이스, 화음을 분리하여 정밀하게 역할별 편곡 수행
- **🎵 AI 기반 음악 분석**: Spotify의 Basic Pitch 딥러닝 모델을 활용한 고정밀 음정 감지
- **⚡ 병렬 처리**: 45초 이상의 긴 오디오 파일을 멀티스레드 청크 처리로 효율적 분석
- **🎯 핑거스타일 최적화**: 멜로디는 고음현, 베이스는 저음현에 배치하는 역할 기반 운지 알고리즘
- **🎹 자동 이조 (Auto-Transpose)**: 연주하기 까다로운 키를 개방현 활용이 쉬운 키(C, G, D, A, E)로 자동 변환
- **🎼 대중적 코드 진행**: 복잡한 코드보다 친숙한 메이저/마이너 코드를 우선하는 심플 코드 알고리즘
- **🧹 지능형 클리닝**: 동시 발음 수 제한(3음), 머신건 아르페지오 방지, 노이즈 제거로 연주 가능한 "깔끔한 악보" 생성
- **⏱️ BPM 자동 감지**: 베이스/드럼 트랙을 활용한 정확한 리듬 분석
- **💾 스마트 캐싱**: 동일한 파일 재처리 방지를 위한 결과 캐싱
- **🤖 MCP 통합**: Claude Desktop과 완벽한 통합으로 대화형 타브 악보 개선
- **🌍 다국어 지원**: 완전한 다국어 지원 (한국어, 영어)
- **⚙️ 높은 설정 가능성**: YAML 기반 설정으로 모든 분석 옵션 커스터마이징

## 📋 목차

- [빠른 시작](#-빠른-시작)
- [설치 방법](#-설치-방법)
- [사용 방법](#-사용-방법)
  - [Claude Desktop 연동 (권장)](#claude-desktop-연동-권장)
  - [커맨드라인 사용](#커맨드라인-사용)
  - [Python API 사용](#python-api-사용)
- [주요 기능 상세](#-주요-기능-상세)
- [설정](#-설정)
- [MCP 도구 레퍼런스](#-mcp-도구-레퍼런스)
- [프로젝트 구조](#-프로젝트-구조)
- [사용 예시](#-사용-예시)
- [문제 해결](#-문제-해결)
- [기여하기](#-기여하기)
- [라이선스](#-라이선스)

## 🚀 빠른 시작

### 필수 조건

시작하기 전에 다음 프로그램이 설치되어 있는지 확인하세요:

- **Python 3.10 이상**: [Python 다운로드](https://www.python.org/downloads/)
- **FFmpeg**: 오디오 처리 및 음원 분리에 필수
  - **macOS**: `brew install ffmpeg`
  - **Ubuntu/Debian**: `sudo apt-get install ffmpeg`
  - **Windows**: [ffmpeg.org](https://ffmpeg.org/download.html)에서 다운로드

### 설치 방법

```bash
# 저장소 클론
git clone https://github.com/blooper20/fingerstyle-tab-mcp.git
cd fingerstyle-tab-mcp

# 가상환경 생성 (권장)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
```

## 📖 사용 방법

### Claude Desktop 연동 (권장)

이 방법이 Fingerstyle Tab MCP 서버를 사용하는 가장 강력한 방법입니다. Claude와 대화하면서 기타 타브 악보를 생성하고 개선하고 커스터마이징할 수 있습니다.

#### 1. 설정 방법

**Step 1: Claude Desktop 설치**
[claude.ai/download](https://claude.ai/download)에서 다운로드

**Step 2: MCP 서버 설정**

Claude Desktop 설정 파일에 다음 내용 추가:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "fingerstyle-mcp": {
      "command": "/절대경로/fingerstyle-tab-mcp/venv/bin/python3",
      "args": ["/절대경로/fingerstyle-tab-mcp/mcp_server.py"],
      "env": {
        "PYTHONPATH": "/절대경로/fingerstyle-tab-mcp"
      }
    }
  }
}
```

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
```json
{
  "mcpServers": {
    "fingerstyle-mcp": {
      "command": "C:\\절대경로\\fingerstyle-tab-mcp\\venv\\Scripts\\python.exe",
      "args": ["C:\\절대경로\\fingerstyle-tab-mcp\\mcp_server.py"],
      "env": {
        "PYTHONPATH": "C:\\절대경로\\fingerstyle-tab-mcp"
      }
    }
  }
}
```

**Step 3: Claude Desktop 재시작**

Claude Desktop을 완전히 종료 (macOS는 Cmd+Q)하고 다시 시작합니다.

**Step 4: 설치 확인**

로그를 확인하여 서버가 성공적으로 시작되었는지 확인:

```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp-server-fingerstyle-mcp.log

# 다음 메시지를 찾으세요:
# 🚀 FINGERSTYLE MCP SERVER IS NOW ONLINE AND READY
```

#### 2. Claude와 함께 사용하기

설정이 완료되면 자연어로 Claude와 대화할 수 있습니다:

**대화 예시:**

> **사용자**: "어떤 오디오 파일들을 사용할 수 있어?"
>
> **Claude**: *`list_available_audio_files` 도구 사용*
>
> resource/ 폴더에 있는 파일들:
> - Adelle-- someone like you-null.mp3
> - Falling Slowly - Once [legendado](MP3_70K)_1.mp3

---

> **사용자**: "'someone like you' 분석해서 기타 타브 만들어줘"
>
> **Claude**: *퍼지 매칭으로 `analyze_audio_to_tab` 도구 사용*
>
> 🎸 핑거스타일 정밀 분석 (BPM: 123.05)
>
>   Dm              G               C               F
> e|----------------|----------------|----------------|----------------|
> B|3---3-------3---|0---0-------0---|1---1-------1---|1---1-------1---|
> G|2---2-------2---|0---0-------0---|0---0-------0---|2---2-------2---|
> D|0---0-------0---|0---0-------0---|2---2-------2---|3---3-------3---|
> A|----------------|2---2-------2---|3---3-------3---|3---3-------3---|
> E|----------------|3---3-------3---|----------------|1---1-------1---|

---

> **사용자**: "10초부터 시작해서 30초만 분석해줘"
>
> **Claude**: *`start_seconds=10.0, duration_seconds=30.0` 파라미터로 `analyze_audio_to_tab` 도구 사용*
>
> 분석 성공 (시작: 10.0초, 길이: 30.0초)...

#### 3. 사용 가능한 MCP 도구

서버는 Claude에게 다음 도구들을 제공합니다:

| 도구 | 설명 |
|------|------|
| `analyze_audio_to_tab` | 오디오 파일을 타브 악보로 변환하는 메인 도구 |
| `list_available_audio_files` | resource/ 디렉토리의 모든 오디오 파일 목록 |
| `tweak_tab_fingering` | 특정 음정의 운지 설정 조정 |
| `get_standard_tuning` | 표준 기타 튜닝 정보 조회 |

상세 문서는 [MCP 도구 레퍼런스](#-mcp-도구-레퍼런스)를 참조하세요.

### 커맨드라인 사용

빠른 테스트나 배치 처리를 위한 방법:

```bash
# 기본 사용법
python test_workflow.py path/to/your/audio.mp3

# resource/ 디렉토리의 파일 사용
python test_workflow.py "someone like you"  # 퍼지 매칭 작동!
```

**출력 예시:**
```
--- 'Adelle-- someone like you-null.mp3' 분석 시작 ---
1. 오디오 분석 중 (BPM 감지 및 Basic Pitch 실행)...
   템포 감지 중...
   감지된 BPM: 123.05
   병렬 분석: 1분 이내 완료를 위해 11개 청크로 분할
   분석 완료: 2554개의 음이 검출되었습니다. (감지된 BPM: 123.05)
2. 기타 타브로 변환 중 (코드 기반 운지 및 주법 분석)...

--- 생성된 타브 악보 ---
🎸 핑거스타일 정밀 분석 (BPM: 123.05)

  Dm              G               C               F
e|----------------|----------------|----------------|----------------|
B|3---3---3---3---|0---0---0---0---|1---1---1---1---|1---1---1---1---|
G|2---2---2---2---|0---0---0---0---|0---0---0---0---|2---2---2---2---|
D|0---0---0---0---|0---0---0---0---|2---2---2---2---|3---3---3---3---|
A|----------------|2---2---2---2---|3---3---3---3---|3---3---3---3---|
E|----------------|3---3---3---3---|----------------|1---1---1---1---|
```

### 지원하는 오디오 형식

- MP3 (`.mp3`)
- WAV (`.wav`)
- FLAC (`.flac`)
- OGG (`.ogg`)
- M4A (`.m4a`)
- AAC (`.aac`)

### Python API 사용

자신의 프로젝트에 통합하기:

```python
from src.transcriber import transcribe_audio
from src.tab_generator import create_tab

# Step 1: 오디오 분석 (옵션 파라미터 포함)
notes, detected_bpm = transcribe_audio(
    "path/to/audio.mp3",
    duration=30.0,        # 선택사항: 처음 30초만 분석
    start_offset=10.0     # 선택사항: 10초부터 시작
)

# Step 2: 타브 악보 생성
tab = create_tab(notes, bpm=detected_bpm)

print(tab)
```

#### 고급 API 사용법

```python
from src.tab_generator import TabGenerator

# 커스텀 설정
generator = TabGenerator(
    tuning=['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],  # Drop D 튜닝
    bpm=140,
    slots_per_measure=16
)

# 커스텀 설정으로 타브 생성
tab = generator.generate_ascii_tab(notes)
```

## 🔥 주요 기능 상세

### 1. 음원 분리 및 역할 분석 (Source Separation)

Demucs 엔진을 사용하여 오디오를 **보컬, 베이스, 기타, 드럼**으로 분리합니다.
 - **보컬** → **멜로디** 역할 (고음현 배치)
 - **베이스** → **베이스** 역할 (저음현 배치)
 - **기타/반주** → **화성** 역할 (중음역 배치)

### 2. 지능형 정제 알고리즘 (Intelligent Processing)

사람이 실제로 연주할 수 있는 악보를 만들기 위해 강력한 필터를 적용합니다:
 - **동시 발음 수 제한**: 한 순간에 최대 3개의 음(베이스+멜로디+화성1)만 남겨 손 꼬임을 방지합니다.
 - **아르페지오 정리**: 같은 줄을 연달아 빠르게 튕기는 '머신건' 패턴을 제거합니다.
 - **화성 정리**: 감지된 코드와 어울리지 않는 불협화음을 자동으로 음소거합니다.

### 3. 자동 이조 (Auto-Transpose)

원곡의 키가 기타로 치기 어려운 경우(예: B Major), 시스템이 자동으로 **개방현을 활용하기 좋은 키(C, G, D, A, E)**로 변환합니다. 일종의 '스마트 카포' 역할을 수행하여 초보자도 쉽게 연주할 수 있게 돕습니다.

### 4. 스마트 캐싱

Demucs 분리 결과와 분석 데이터는 캐싱되어, 두 번째 시도부터는 즉시 결과가 나옵니다.

## ⚙️ 설정

프로젝트 루트에 `config.yaml` 파일을 생성하여 동작 커스터마이징:

```bash
cp config.yaml.example config.yaml
```

### 설정 옵션

```yaml
# 오디오 처리
audio:
  source_separation: true   # Demucs 음원 분리 활성화 (고품질 권장)
  separation_model: "htdemucs"
  default_bpm: 120.0
  parallel_threshold: 45.0

# 정제 및 후처리 (Post-processing)
post_processing:
  min_note_duration: 0.15     # 짧은 노이즈 제거
  min_velocity: 0.45          # 약한 음표 제거 (감도 조절)
  quantize: true              # 16분음표 단위로 박자 보정
  snap_harmony_to_key: true   # 불협화음 제거
  max_polyphony: 3            # 동시 발음 수 제한 (난이도 조절)

# 타브 악보 생성
tablature:
  auto_transpose: true        # C/G/D/A/E 키로 자동 변환
  standard_tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
  slots_per_measure: 16
  preferred_fret_range:
    min: 0
    max: 5                    # 오픈 포지션 우선
```

모든 사용 가능한 옵션은 [config.yaml.example](config.yaml.example)을 참조하세요.

## 🛠 MCP 도구 레퍼런스

### `analyze_audio_to_tab`

오디오-타브 변환을 위한 메인 도구.

**파라미터:**
- `file_path` (문자열, 필수): 오디오 파일 경로 또는 파일명만
  - 절대 경로 지원: `/Users/you/Music/song.mp3`
  - 상대 경로 지원: `~/Music/song.mp3`
  - 파일명만 지원: `song.mp3` (`resource/`에서 검색)
  - 퍼지 매칭 지원: `someone like you` → `Adelle-- someone like you-null.mp3` 찾음
- `duration_seconds` (실수, 선택): N초로 분석 제한 (기본값: 전체 파일 처리)
- `start_seconds` (실수, 선택): N초부터 분석 시작 (기본값: 0.0)

**반환값:**
- 코드 주석과 BPM 정보가 포함된 ASCII 기타 타브 악보

**예시:**
```python
# 전체 파일
analyze_audio_to_tab("song.mp3")

# 처음 30초
analyze_audio_to_tab("song.mp3", duration_seconds=30.0)

# 1분 지점부터 30초
analyze_audio_to_tab("song.mp3", start_seconds=60.0, duration_seconds=30.0)
```

### `list_available_audio_files`

`resource/` 디렉토리의 모든 오디오 파일 목록.

**파라미터:** 없음

**반환값:**
- 사용 가능한 오디오 파일 목록

**예시:**
```
resource/ 폴더에 있는 파일들:
- Adelle-- someone like you-null.mp3
- Falling Slowly - Once [legendado](MP3_70K)_1.mp3
```

### `tweak_tab_fingering`

특정 MIDI 음정의 선호 줄 제안.

**파라미터:**
- `note_pitch` (정수, 필수): MIDI 음정 (0-127)
- `preferred_string` (정수, 필수): 대상 줄 번호 (1=높은 E, 6=낮은 E)

**반환값:**
- 확인 메시지

### `get_standard_tuning`

표준 기타 튜닝 참조 정보 조회.

**파라미터:** 없음

**반환값:**
```
표준 튜닝: E2, A2, D3, G3, B3, E4 (82.41Hz - 329.63Hz)
```

## 🛠 프로젝트 구조

```
fingerstyle-tab-mcp/
├── src/
│   ├── transcriber.py       # 오디오 분석 & 병렬 처리
│   │   ├── transcribe_audio()      # 메인 음악 분석 함수
│   │   ├── get_model()             # 모델 캐싱
│   │   └── _transcribe_chunk()     # 청크 처리
│   ├── tab_generator.py     # 스마트 운지 & ASCII 타브 생성
│   │   ├── TabGenerator            # 메인 생성기 클래스
│   │   ├── create_tab()            # 고수준 API
│   │   └── CHORD_LIBRARY           # 40개 이상 코드 템플릿
│   └── config.py            # 설정 관리
├── locales/                 # 다국어 파일
│   ├── en/LC_MESSAGES/      # 영어 번역
│   └── ko/LC_MESSAGES/      # 한국어 번역
├── resource/                # 예제 오디오 파일 (여기에 파일 배치)
├── mcp_server.py            # MCP 서버 구현
├── test_workflow.py         # 커맨드라인 테스트 도구
├── requirements.txt         # Python 의존성
├── setup.py                 # 패키지 설치 스크립트
├── config.yaml.example      # 설정 예시
├── README.md                # 영문 문서
├── README_KR.md             # 이 문서
└── LICENSE                  # MIT 라이선스
```

### 주요 컴포넌트

- **[src/transcriber.py](src/transcriber.py)**: 오디오 분석 엔진
  - 긴 파일 병렬 처리 (45초 이상)
  - 재로딩 방지를 위한 전역 모델 캐싱
  - Librosa를 이용한 BPM 감지
  - Spotify Basic Pitch로 음표 추출
  - 청크 수준 에러 핸들링

- **[src/tab_generator.py](src/tab_generator.py)**: 타브 생성 엔진
  - 40개 이상 코드 타입 인식
  - 스마트 운지 알고리즘 (오픈 코드 우선)
  - 코드 주석이 포함된 ASCII 타브 렌더링
  - 마디 기반 포맷팅

- **[mcp_server.py](mcp_server.py)**: MCP 프로토콜 서버
  - 퍼지 매칭을 통한 스마트 파일 검색
  - 성능을 위한 결과 캐싱
  - 포괄적 에러 핸들링
  - stdout/stderr 깔끔한 분리
  - 다국어 지원

## 📚 사용 예시

### 예시 1: 기본 사용법

```bash
# resource/ 디렉토리에 기타 녹음 파일 배치
cp ~/Music/my_song.mp3 resource/

# 분석 실행
python test_workflow.py "my_song"
```

### 예시 2: 특정 구간 분석

```python
from src.transcriber import transcribe_audio
from src.tab_generator import create_tab

# 후렴구만 분석 (1:20부터 30초)
notes, bpm = transcribe_audio(
    "resource/song.mp3",
    start_offset=80.0,      # 1:20 = 80초
    duration=30.0
)

tab = create_tab(notes, bpm=bpm)
print(tab)
```

### 예시 3: 커스텀 튜닝

```python
from src.tab_generator import TabGenerator

# Drop D 튜닝 (DADGBE)
generator = TabGenerator(
    tuning=['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
    bpm=140
)

tab = generator.generate_ascii_tab(notes)
print(tab)
```

### 예시 4: 배치 처리

```python
import glob
import os
from src.transcriber import transcribe_audio
from src.tab_generator import create_tab

# 디렉토리의 모든 MP3 파일 처리
for audio_file in glob.glob("resource/*.mp3"):
    print(f"처리 중: {audio_file}...")

    try:
        # 음악 분석
        notes, bpm = transcribe_audio(audio_file)

        # 타브 생성
        tab = create_tab(notes, bpm=bpm)

        # 텍스트 파일로 저장
        output_file = audio_file.replace('.mp3', '_tab.txt')
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(tab)

        print(f"✓ {output_file}에 저장됨")
    except Exception as e:
        print(f"✗ 실패: {e}")
```

## 🌍 다국어 지원

이 프로젝트는 `gettext`를 사용하여 여러 언어를 지원합니다.

### 지원 언어

- **English** (en) - 기본
- **Korean** (ko) - 한국어 완전 지원

### 새 언어 추가

1. **번역 가능한 문자열 추출:**
```bash
xgettext -o locales/messages.pot src/*.py mcp_server.py
```

2. **언어별 번역 생성:**
```bash
# 'ja'를 원하는 언어 코드로 변경 (예: 'es' for Spanish)
msginit -i locales/messages.pot -o locales/ja/LC_MESSAGES/messages.po -l ja
```

3. **`.po` 파일의 문자열 번역**

4. **번역 컴파일:**
```bash
msgfmt locales/ja/LC_MESSAGES/messages.po -o locales/ja/LC_MESSAGES/messages.mo
```

5. **언어 환경변수 설정:**
```bash
export LANG=ja_JP.UTF-8  # 일본어의 경우
python test_workflow.py "song.mp3"
```

## 🐛 문제 해결

### 일반적인 문제

#### 문제: Claude Desktop에서 MCP 서버가 보이지 않음

**해결방법:**
1. 설정 파일 경로 확인:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. 경로가 절대 경로인지 확인 (상대 경로 아님)
3. Claude Desktop 완전히 재시작 (macOS: Cmd+Q, 창 닫기가 아님)
4. 로그 확인: `tail -f ~/Library/Logs/Claude/mcp-server-fingerstyle-mcp.log`

#### 문제: 서버가 시작되지만 즉시 종료됨

**해결방법:**
1. 로그에서 시작 배너 확인:
   ```
   🚀 FINGERSTYLE MCP SERVER IS NOW ONLINE AND READY
   ```
2. import 에러가 보이면 모든 의존성 설치 확인:
   ```bash
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. 서버 수동 테스트:
   ```bash
   ./venv/bin/python3 -c "from src.transcriber import transcribe_audio"
   ```

#### 문제: `ModuleNotFoundError: No module named 'basic_pitch'`

**해결방법:**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

#### 문제: `FileNotFoundError: Audio file not found`

**해결방법:**
- 파일이 `resource/` 디렉토리에 존재하는지 확인
- `list_available_audio_files` 도구로 사용 가능한 파일 확인
- 파일명 일부로 퍼지 매칭 시도

#### 문제: 병렬 처리가 "chunk error"로 실패

**해결방법:**
- 일반적으로 오디오 청크 중 하나가 처리되지 못한 것
- 에러 로그에서 실패한 특정 청크 확인
- 더 짧은 구간 처리로 문제 격리
- 오디오 파일 손상 여부 확인

#### 문제: BPM 감지가 부정확함

**해결방법:**
- 오디오의 처음 60초가 BPM 감지에 사용됨
- 파일 시작 부분에 명확한 리듬이 있는지 확인
- 코드에서 BPM 수동 오버라이드 가능:
  ```python
  notes, _ = transcribe_audio("song.mp3")
  tab = create_tab(notes, bpm=120)  # BPM을 120으로 고정
  ```

#### 문제: 음표가 감지되지 않거나 매우 적게 감지됨

**해결방법:**
- 믹스에서 기타가 두드러지는지 확인 (다른 악기에 묻혀있지 않은지)
- 오디오 파일 볼륨 증가 시도
- 오디오 품질이 좋은지 확인 (과도하게 압축되지 않았는지)
- 솔로 기타 녹음이 최적

#### 문제: 타브 악보가 연주 불가능하거나 이상한 운지 사용

**해결방법:**
- 알고리즘이 오픈 코드 형태 우선 (0-5 프렛)
- `tweak_tab_fingering` 도구로 특정 음표 조정 시도
- 원본 녹음이 다른 튜닝을 사용하는지 고려

### 도움 받기

- 📝 **버그 리포트**: [이슈 등록](https://github.com/blooper20/fingerstyle-tab-mcp/issues)
- 💬 **질문하기**: [토론 시작](https://github.com/blooper20/fingerstyle-tab-mcp/discussions)
- 📖 **문서 확인**: [영문 README](./README.md) 참조

### 디버그 모드

문제 해결을 위한 디버그 로깅 활성화:

```bash
# config.yaml에서
logging:
  level: DEBUG

# 또는 환경변수 설정
export LOG_LEVEL=DEBUG
python test_workflow.py "song.mp3"
```

## 🤝 기여하기

기여를 환영합니다! 다음과 같이 도움을 주실 수 있습니다:

### 개발 환경 설정

```bash
# 클론 및 설정
git clone https://github.com/blooper20/fingerstyle-tab-mcp.git
cd fingerstyle-tab-mcp

# 가상환경 생성
python3 -m venv venv
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 테스트 실행 (있는 경우)
python -m pytest tests/
```

### 기여 가능 영역

- 🎵 **정확도 개선**: 더 나은 코드 감지 및 운지 알고리즘
- 🎸 **기능 추가**: 대체 튜닝, 카포 위치, MIDI 내보내기 지원
- 🌍 **번역**: 더 많은 언어 지원 추가
- 📊 **시각화**: PDF 내보내기, 더 나은 ASCII 렌더링
- 🧪 **테스팅**: 테스트 커버리지 추가
- 📖 **문서화**: 예시 및 튜토리얼 개선
- 🐛 **버그 수정**: 이슈 및 엣지 케이스 수정
- ⚡ **성능**: 처리 속도 최적화

### 커밋 메시지 가이드라인

Conventional Commits을 사용합니다:

```
feat: MIDI 내보내기 기능 추가
fix: suspended 코드 감지 해결
docs: 설치 방법 업데이트
style: black으로 코드 포맷
refactor: 타브 생성 로직 간소화
test: 병렬 처리 테스트 추가
chore: 의존성 업데이트
```

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 라이브러리를 사용합니다:

- [Basic Pitch](https://github.com/spotify/basic-pitch) by Spotify - 오디오-MIDI 변환
- [Librosa](https://librosa.org/) - 오디오 분석 및 BPM 감지
- [Music21](https://web.mit.edu/music21/) - 음악 이론 및 코드 감지
- [FastMCP](https://github.com/jlowin/fastmcp) - MCP 서버 프레임워크
- [NumPy](https://numpy.org/) - 수치 계산
- [SoundFile](https://github.com/bastibe/python-soundfile) - 오디오 I/O

이 프로젝트를 가능하게 해준 오픈소스 커뮤니티에 감사드립니다.

## 📜 라이선스

이 프로젝트는 [MIT License](./LICENSE)에 따라 라이선스가 부여됩니다.

상업적 사용을 포함하여 모든 목적으로 이 소프트웨어를 자유롭게 사용, 수정 및 배포할 수 있습니다.

## 🗺️ 로드맵

### 단기
- [ ] MIDI 파일 내보내기
- [ ] 대체 튜닝 지원 (Drop D, DADGAD 등)
- [ ] 카포 위치 감지
- [ ] 운지 커스터마이징 개선

### 중기
- [ ] 악보 표기가 포함된 PDF 타브 내보내기
- [ ] Guitar Pro 형식 내보내기

### 장기
- [ ] 여러 악기 지원 (베이스, 우쿨렐레)
- [ ] 커스텀 운지 선호도를 위한 머신러닝
- [ ] 실시간 오디오 처리

---

**오픈소스 커뮤니티를 위해 ❤️로 만들었습니다**

**유용하다면 이 저장소에 별표** ⭐를 눌러주세요!
