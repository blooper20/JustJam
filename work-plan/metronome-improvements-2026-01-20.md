# Work Plan: Metronome Feature Improvements

**Date**: 2026-01-20
**Author**: Claude
**Status**: Pending Review

---

## Summary

요구사항 점검 결과, 대부분의 기능이 구현되어 있으나 4가지 개선이 필요합니다.

---

## Current Implementation Status

### 1. Metronome Sound & Logic (메트로놈 사운드 및 로직)

| Requirement | Status | File | Line |
|-------------|--------|------|------|
| 강약 패턴 (4/4박자, 틱-톡-톡-톡) | ✅ Done | `client/components/multitrack-player.tsx` | 191-209 |
| 사운드 개선 (목탁 톤) | ✅ Done | `client/components/multitrack-player.tsx` | 179-188 |
| 백엔드 통합 (Mix에 메트로놈 포함) | ✅ Done | `src/api/routes/projects.py` | 265-323 |
| 동기화 (OfflineAudioContext) | ✅ Done | `client/components/multitrack-player.tsx` | 172-218 |

### 2. BPM Control (BPM 제어)

| Requirement | Status | File | Line |
|-------------|--------|------|------|
| 입력 버퍼링 & Set 버튼 | ✅ Done | `client/components/multitrack-player.tsx` | 54, 651-679 |
| Set 버튼 동작 (재생 중지 후 적용) | ✅ Done | `client/components/multitrack-player.tsx` | 666-676 |
| AI BPM 표시 (Unknown 처리) | ✅ Done | `client/app/projects/[id]/page.tsx` | 109 |
| TAP BPM 기능 | ✅ Done | `client/components/multitrack-player.tsx` | 532-553, 680-692 |

### 3. Visual Metronome (시각적 메트로놈)

| Requirement | Status | File | Line |
|-------------|--------|------|------|
| 4비트 인디케이터 (첫 박 강조) | ✅ Done | `client/components/multitrack-player.tsx` | 696-709 |

### 4. Start Offset Control (메트로놈 시작 시점 제어)

| Requirement | Status | File | Line |
|-------------|--------|------|------|
| Start Offset (초 단위) | ✅ Done | `client/components/multitrack-player.tsx` | 56, 636-647 |
| 빨간색 화살표 마커 (드래그 가능) | ✅ Done | `client/components/multitrack-player.tsx` | 614-626, 377-405 |
| 백엔드에 Start Offset 전달 | ⚠️ **Missing** | `client/lib/api.ts` | 118-138 |

### 5. Master Waveform & Navigation (마스터 웨이브폼 & 탐색)

| Requirement | Status | File | Line |
|-------------|--------|------|------|
| 전체 파형 시각화 (모든 스템 합성) | ⚠️ **Needs Work** | `client/components/multitrack-player.tsx` | 310-355 |
| 노란색 진행 바 (#facc15) | ✅ Done | `client/components/multitrack-player.tsx` | 325, 332 |
| 재생 위치 변경 (클릭) | ✅ Done | `client/components/multitrack-player.tsx` | 345-348 |
| 재생 위치 변경 (드래그 스크러빙) | ✅ Done | `client/components/multitrack-player.tsx` | 340-355 |

> ⚠️ **Note**: 현재 마스터 웨이브폼은 단일 스템(drums > bass > first)만 표시하고 있음. 요구사항은 **전체 곡(모든 스템 합성)의 파형**을 표시하는 것임.

---

## Required Improvements

### Issue #1: Metronome Sound Quality
**Priority**: Medium
**Complexity**: Low
**Status**: ✅ **Resolved**

**Problem**: 현재 메트로놈 사운드가 단순 Sine wave로 구현되어 있음. 요구사항은 "목탁(우드블럭)" 톤.

**Current Implementation** (`multitrack-player.tsx:179-188`):
```typescript
const createClickBuffer = (freq: number, decay: number) => {
    const dur = 0.1;
    const buffer = offlineCtx.createBuffer(1, sampleRate * dur, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        // Simple sine wave with exponential decay
        data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * decay);
    }
    return buffer;
};
```

**Solution**: 우드블럭 톤은 여러 하모닉스가 합성된 사운드. FM synthesis 또는 multiple harmonics를 사용하여 개선.

**Files to Modify**:
- `client/components/multitrack-player.tsx` (lines 179-188)
- `src/api/routes/projects.py` (lines 291-293) - 백엔드도 동일하게 개선 필요

---

### Issue #2: Master Waveform Shows Single Stem Instead of Combined Audio
**Priority**: High
**Complexity**: Medium

**Problem**: 현재 마스터 웨이브폼이 단일 스템(drums > bass > first)만 표시하고 있음. 요구사항은 **전체 곡(vocals, drums, bass, guitar, piano, other 모두 합성된)의 파형**을 보여주는 것임.

**Current Implementation** (`multitrack-player.tsx:314-315`):
```typescript
// Pick a stem for visualization (Drums > Bass > First)
const masterTrack = tracks.find(t => t.name === 'drums') || tracks.find(t => t.name === 'bass') || tracks[0];
```

**Solution**:
1. **방법 A (권장)**: 백엔드에서 모든 스템을 합친 "master.wav" 파일을 생성하여 제공
2. **방법 B**: 클라이언트에서 Web Audio API로 모든 스템을 합성하여 파형 생성

**Recommended Approach**: 방법 A가 더 효율적. 백엔드에서 스템 분리 완료 시 모든 스템을 합친 master.wav도 함께 생성.

**Files to Modify**:
- `src/api/routes/projects.py` - 스템 분리 후 master.wav 생성 로직 추가
- `src/api/schemas/project.py` - StemFiles에 `master` 필드 추가
- `client/components/multitrack-player.tsx` (lines 310-355) - master.wav URL 사용하도록 변경

---

### Issue #3: Drag Scrubbing on Master Waveform
**Priority**: High
**Complexity**: Medium
**Status**: ✅ **Resolved**

**Problem**: 마스터 웨이브폼에서 클릭은 가능하지만, 드래그하면서 연속적으로 위치를 탐색(스크러빙)하는 기능이 없음.

**Current Implementation**: WaveSurfer의 `interaction` 이벤트만 사용 (클릭 한 번).

**Solution**: 마우스 드래그 시 연속적으로 `handleSeek` 호출하여 실시간 스크러빙 구현.

**Files to Modify**:
- `client/components/multitrack-player.tsx` (add drag scrubbing logic around lines 340-355)

---

### Issue #4: Start Offset Not Passed to Backend Mix
**Priority**: Medium
**Complexity**: Low

**Problem**: 클라이언트에서 설정한 `startOffsetSeconds`가 백엔드 `/mix` API에 전달되지 않음. 따라서 다운로드된 믹스에서 메트로놈이 처음부터 시작됨.

**Current API Call** (`api.ts:124`):
```typescript
body: JSON.stringify({ volumes, bpm, metronome: metronomeVolume }),
```

**Solution**: `startOffset` 파라미터 추가하여 백엔드에서 메트로놈 시작 지점 조절.

**Files to Modify**:
- `client/lib/api.ts` (line 118-124) - `startOffset` 파라미터 추가
- `client/components/multitrack-player.tsx` (line 574) - API 호출 시 `startOffsetSeconds` 전달
- `src/api/routes/projects.py` (lines 234-237, 280) - `MixRequest`에 `start_offset` 추가 및 처리

---

## Implementation Tasks

### Task 1: Improve Metronome Sound to Woodblock Tone

```typescript
// Proposed implementation for woodblock-like sound
const createWoodblockBuffer = (freq: number, isStrong: boolean) => {
    const dur = 0.08;
    const buffer = offlineCtx.createBuffer(1, sampleRate * dur, sampleRate);
    const data = buffer.getChannelData(0);

    // Woodblock has multiple harmonics with quick decay
    const harmonics = isStrong ? [1, 2.4, 4.1, 6.3] : [1, 2.2, 3.8];
    const amplitudes = isStrong ? [1, 0.5, 0.3, 0.15] : [0.8, 0.4, 0.2];
    const decay = isStrong ? 35 : 45;

    for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        let sample = 0;

        for (let h = 0; h < harmonics.length; h++) {
            sample += amplitudes[h] * Math.sin(2 * Math.PI * freq * harmonics[h] * t);
        }

        // Sharp attack, quick decay (woodblock characteristic)
        const envelope = Math.exp(-t * decay) * (1 - Math.exp(-t * 500));
        data[i] = sample * envelope * 0.7;
    }
    return buffer;
};
```

### Task 2: Generate Combined Master Waveform

**Backend Changes** (`src/api/routes/projects.py`):
```python
# After stem separation is complete, add this in process_audio_task():
def create_master_mix(stem_dir: str) -> str:
    """Combine all stems into a master.wav file for waveform visualization"""
    from pydub import AudioSegment

    stems = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']
    master = None

    for stem in stems:
        stem_path = os.path.join(stem_dir, f"{stem}.wav")
        if os.path.exists(stem_path):
            audio = AudioSegment.from_wav(stem_path)
            if master is None:
                master = audio
            else:
                master = master.overlay(audio)

    if master:
        master_path = os.path.join(stem_dir, "master.wav")
        master.export(master_path, format="wav")
        return master_path
    return None
```

**Schema Changes** (`src/api/schemas/project.py`):
```python
class StemFiles(BaseModel):
    vocals: Optional[str] = None
    bass: Optional[str] = None
    drums: Optional[str] = None
    guitar: Optional[str] = None
    piano: Optional[str] = None
    other: Optional[str] = None
    master: Optional[str] = None  # Add this field
```

**API Changes** (`src/api/routes/projects.py` - get_project_stems):
```python
return StemFiles(
    vocals=f"{base_url}/vocals.wav",
    bass=f"{base_url}/bass.wav",
    drums=f"{base_url}/drums.wav",
    guitar=f"{base_url}/guitar.wav",
    piano=f"{base_url}/piano.wav",
    other=f"{base_url}/other.wav",
    master=f"{base_url}/master.wav"  # Add this
)
```

**Client Changes** (`client/components/multitrack-player.tsx`):
```typescript
// Update props interface
interface StemFiles {
    vocals?: string | null;
    bass?: string | null;
    drums?: string | null;
    guitar?: string | null;
    piano?: string | null;
    other?: string | null;
    master?: string | null;  // Add this
}

// Update master waveform initialization (around line 315)
// Before:
const masterTrack = tracks.find(t => t.name === 'drums') || tracks.find(t => t.name === 'bass') || tracks[0];

// After:
const masterUrl = stems.master;  // Use combined master audio

// Update WaveSurfer creation to use masterUrl directly
const ws = WaveSurfer.create({
    container: masterContainerRef.current,
    waveColor: '#52525b',
    progressColor: '#facc15',
    url: masterUrl,  // Use master URL instead of single stem
    // ... rest of config
});
```

---

### Task 3: Add Drag Scrubbing to Master Waveform

```typescript
// Add state
const [isDraggingWaveform, setIsDraggingWaveform] = useState(false);

// Add mouse handlers to master waveform container
const handleWaveformMouseDown = (e: React.MouseEvent) => {
    setIsDraggingWaveform(true);
    handleWaveformSeek(e);
};

const handleWaveformSeek = (e: React.MouseEvent | MouseEvent) => {
    if (!masterContainerRef.current || !duration) return;
    const rect = masterContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    handleSeek([ratio * duration]);
};

// Add global mouse event listeners when dragging
useEffect(() => {
    if (!isDraggingWaveform) return;

    const handleMouseMove = (e: MouseEvent) => handleWaveformSeek(e);
    const handleMouseUp = () => setIsDraggingWaveform(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
}, [isDraggingWaveform, duration]);
```

### Task 4: Pass Start Offset to Backend

**api.ts changes:**
```typescript
export const downloadMix = async (
    id: string,
    volumes: Record<string, number>,
    bpm: number = 120,
    metronomeVolume: number = 0,
    startOffset: number = 0  // Add this parameter
): Promise<{ url: string }> => {
    // ...
    body: JSON.stringify({
        volumes,
        bpm,
        metronome: metronomeVolume,
        start_offset: startOffset  // Add to request body
    }),
};
```

**projects.py changes:**
```python
class MixRequest(BaseModel):
    volumes: Dict[str, float]
    bpm: float = 120.0
    metronome: float = 0.0
    start_offset: float = 0.0  # Add this field

# In mix generation (line ~280):
beat_times = np.arange(request.start_offset, duration_sec, 60.0 / tempo)
```

---

## Testing Checklist

- [x] 메트로놈 사운드가 목탁처럼 들리는지 확인
- [x] 강박(첫 박)과 약박의 음색 차이가 명확한지 확인
- [ ] 마스터 웨이브폼이 전체 곡(모든 스템 합성)의 파형을 보여주는지 확인
- [x] 마스터 웨이브폼에서 드래그 시 연속적으로 재생 위치가 변경되는지 확인
- [x] 드래그 스크러빙 중 오디오가 끊기지 않는지 확인
- [ ] Start Offset 설정 후 믹스 다운로드 시 메트로놈이 해당 지점부터 시작하는지 확인
- [x] 모든 기존 기능이 정상 작동하는지 회귀 테스트

---

## Files Summary

| File | Changes Required |
|------|------------------|
| `client/components/multitrack-player.tsx` | 4 changes (sound, master waveform, scrubbing, api call) |
| `client/lib/api.ts` | 2 changes (add startOffset param, add master to StemFiles) |
| `src/api/routes/projects.py` | 3 changes (sound, master.wav generation, start_offset) |
| `src/api/schemas/project.py` | 1 change (add master field to StemFiles) |

---

## Notes

- 백엔드의 librosa.clicks()도 목탁 톤으로 변경하려면 커스텀 클릭 생성 로직 필요
- 드래그 스크러빙 시 성능 최적화 필요 (throttle 적용 고려)
- Start Offset이 음수일 경우의 처리 로직도 고려 필요 (현재는 0 이상만 허용)
- master.wav 생성은 스템 분리 완료 후 `process_audio_task()`에서 수행하면 됨
- master.wav 파일 크기가 클 수 있으므로, 웨이브폼 시각화용으로만 사용하고 재생은 기존 개별 스템 사용 유지
