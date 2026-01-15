import os
import sys
from src.transcriber import transcribe_audio
from src.tab_generator import TabGenerator

def test_conversion(audio_path):
    """
    오디오 파일을 입력받아 전사 및 타브 생성을 수행하고 결과를 출력합니다.
    """
    if not os.path.exists(audio_path):
        print(f"에러: 파일이 존재하지 않습니다: {audio_path}")
        return

    print(f"--- '{audio_path}' 분석 시작 ---")
    try:
        # 1. 전사 테스트
        print("1. 오디오 분석 중 (BPM 감지 및 Basic Pitch 실행)...")
        notes, detected_bpm = transcribe_audio(audio_path)
        print(f"   분석 완료: {len(notes)}개의 음이 검출되었습니다. (감지된 BPM: {detected_bpm:.2f})")

        # 2. 타브 생성 테스트
        print("2. 기타 타브로 변환 중 (코드 기반 운지 및 주법 분석)...")
        generator = TabGenerator(bpm=detected_bpm)
        tab = generator.generate_ascii_tab(notes)
        
        print("\n--- 생성된 타브 악보 ---")
        print(tab)
        print("------------------------")
        
    except Exception as e:
        print(f"오류 발생: {str(e)}")

if __name__ == "__main__":
    # 테스트할 오디오 파일 경로를 인자로 받거나 직접 지정 가능
    if len(sys.argv) > 1:
        test_conversion(sys.argv[1])
    else:
        print("사용법: python test_workflow.py [오디오_파일_경로]")
        print("예: python test_workflow.py sample_melody.mp3")
