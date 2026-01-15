import os
import logging
import subprocess
import sys
import platform
import re
from pathlib import Path
from typing import Optional, Dict, Callable
import shutil
from src.config import config

logger = logging.getLogger(__name__)

def separate_audio(input_path: str, output_dir: Optional[str] = None, model_name: Optional[str] = None, progress_callback: Optional[Callable[[int], None]] = None) -> Dict[str, str]:
    """
    Separate audio into stems using Demucs and return paths to stems.
    
    Args:
        input_path: Path to the input audio file.
        output_dir: Directory to save separated files.
        model_name: Demucs model to use (e.g. 'htdemucs', 'htdemucs_6s').
        progress_callback: Optional function to call with progress percentage (0-100).
        
    Returns:
        Dictionary with keys 'vocals', 'bass', 'other', 'drums' (and 'piano', 'guitar') pointing to file paths.
        If separation checks fail or is disabled, returns {'original': input_path}.
    """
    if not config.get('audio', 'source_separation', False) and model_name is None:
        return {'original': input_path}

    if model_name is None:
        model_name = config.get('audio', 'separation_model', 'htdemucs')
    
    input_file = Path(input_path)
    if not input_file.exists():
        logger.error(f"Input file not found: {input_path}")
        return {'original': input_path}

    # Define output directory
    if output_dir is None:
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_dir = os.path.join(project_root, 'temp', 'separated')
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Check if already separated
    track_name = input_file.stem
    base_output = Path(output_dir) / model_name / track_name
    
    # Basic stems
    expected_stems = ['vocals', 'bass', 'drums', 'other']
    if '6s' in model_name:
        expected_stems.extend(['guitar', 'piano'])
        
    stems = {name: base_output / f"{name}.wav" for name in expected_stems}
    
    # Check if all exist
    if all(s.exists() for s in stems.values()):
        logger.info(f"Stems found in cache for: {track_name}")
        if progress_callback:
            progress_callback(100)
        return {k: str(v) for k, v in stems.items()}

    logger.info(f"Starting source separation for {input_file.name} using {model_name}...")
    logger.info("This process may take a few minutes...")

    try:
        cmd = [
            sys.executable, "-m", "demucs",
            "-n", model_name,
            "--out", str(output_dir),
            "-j", "2",  # Use 2 threads
        ]

        # Enable MPS acceleration on Mac if available
        # Enable MPS acceleration on Mac if available
        if platform.system() == 'Darwin' and platform.machine() == 'arm64':
             cmd.extend(["-d", "mps"])
             logger.info("Using MPS acceleration")
        
        cmd.append(str(input_path))
        
        # Prepare environment with correct PATH for ffmpeg
        env = os.environ.copy()
        # Ensure /opt/homebrew/bin and /usr/local/bin are in PATH for ffmpeg
        env["PATH"] = f"/opt/homebrew/bin:/usr/local/bin:{env.get('PATH', '')}"
        
        # Use Popen to capture progress
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True,
            env=env
        )

        # Regex to capture percentage from tqdm progress bar (e.g. " 15%|")
        progress_pattern = re.compile(r'\s*(\d+)%\|')
        
        stderr_lines = []

        # Monitor stderr for progress 
        while True:
            line = process.stderr.readline()
            if not line and process.poll() is not None:
                break
            
            if line:
                stderr_lines.append(line)
                match = progress_pattern.search(line)
                if match:
                    percent = int(match.group(1))
                    if progress_callback:
                        progress_callback(percent)
        
        # Wait for process to finish filling buffers
        stdout_out, _ = process.communicate()
        
        # Check return code
        if process.returncode != 0:
            # Reconstruct full stderr from accumulated lines
            full_stderr = "".join(stderr_lines)
            
            error_message = (
                f"Demucs process failed with return code {process.returncode}.\n"
                f"STDOUT:\n{stdout_out}\n"
                f"STDERR:\n{full_stderr}"
            )
            
            # Log error to file for debugging
            error_log_path = os.path.join(output_dir, f"{track_name}_error.log")
            with open(error_log_path, "w") as f:
                f.write(error_message)
            
            logger.error(error_message)
            
            raise subprocess.CalledProcessError(process.returncode, cmd, stderr=full_stderr)

        logger.info("Source separation completed successfully.")
        if progress_callback:
            progress_callback(100)
        
        import librosa
        import numpy as np
        
        result_paths = {}
        # Dynamically find all wav files in the output directory
        if base_output.exists():
            for f in base_output.glob("*.wav"):
                # Check for silence before adding
                try:
                    # Fast load
                    y, _ = librosa.load(str(f), sr=8000, duration=30)
                    if np.max(np.abs(y)) < 0.01:
                        logger.info(f"Skipping silent stem: {f.name}")
                        continue
                except Exception:
                    pass
                    
                result_paths[f.stem] = str(f)
        
        if not result_paths:
             logger.warning("No stems found after separation.")
             return {'original': input_path}
             
        return result_paths

    except subprocess.CalledProcessError as e:
        logger.error(f"Demucs failed: {e.stderr}")
        return {'original': input_path}
    except Exception as e:
        logger.error(f"Error during separation: {str(e)}")
        # Log generic error to file
        try:
             error_log_path_gen = os.path.join(output_dir, "generic_error.log")
             with open(error_log_path_gen, "w") as f:
                 f.write(str(e))
        except:
            pass
        return {'original': input_path}
