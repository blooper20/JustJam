import sys
import logging
from src.transcriber import transcribe_audio
from src.tab_generator import TabGenerator
from src.config import config

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def generate_bass_tab(file_path):
    print(f"--- Processing Bass Tab for: {file_path} ---")
    
    # 1. Transcribe (Enable source separation to get Bass stem)
    # Config is a singleton object, accessing internal dict for runtime override
    config._config['audio']['source_separation'] = True
    config._config['post_processing']['max_polyphony'] = 1 # Monophonic bass
    config._config['tablature']['auto_transpose'] = False # Keep original key for bass
    
    print("1. Transcribing audio (extracting bass stem)...")
    notes, bpm = transcribe_audio(file_path)
    
    # 2. Filter for Bass role
    bass_notes = [n for n in notes if n.get('role') == 'bass']
    
    if not bass_notes:
        print("Warning: No bass notes detected in 'bass' stem. Trying to infer from low frequencies...")
        bass_notes = [n for n in notes if n['pitch'] < 55] # Below G2
        
    print(f"   Detected {len(bass_notes)} bass notes. BPM: {bpm}")
    
    # 3. Generate Tab for 4-String Bass
    print("2. Generating Bass Tab (Standard Tuning E1-G2)...")
    
    # Standard Bass Tuning: E1, A1, D2, G2
    bass_tuning = ['E1', 'A1', 'D2', 'G2']
    
    generator = TabGenerator(
        tuning=bass_tuning,
        bpm=bpm,
        slots_per_measure=16
    )
    
    # Generate ASCII Tab
    tab = generator.generate_ascii_tab(bass_notes)
    
    print("\n--- Generated Bass Tab ---\n")
    print(tab)
    
    # Save to file
    output_file = file_path.replace('.mp3', '_bass_tab.txt')
    with open(output_file, 'w') as f:
        f.write(f"Bass Tab for {file_path}\n")
        f.write(f"BPM: {bpm}\n\n")
        f.write(tab)
    print(f"\nSaved to {output_file}")

if __name__ == "__main__":
    target_file = "resource/1998.mp3"
    import os
    if not os.path.exists(target_file):
        # fuzzy search
        import glob
        files = glob.glob(f"resource/*1998*")
        if files:
            target_file = files[0]
        else:
            print("File not found.")
            sys.exit(1)
            
    generate_bass_tab(target_file)
