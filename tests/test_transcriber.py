"""
Tests for the transcriber module
"""
import pytest
from pathlib import Path
from src.transcriber import transcribe_audio, validate_audio_file, SUPPORTED_FORMATS


class TestValidateAudioFile:
    """Tests for audio file validation"""

    def test_validate_existing_mp3(self, tmp_path):
        """Test validation of existing MP3 file"""
        audio_file = tmp_path / "test.mp3"
        audio_file.touch()
        result = validate_audio_file(str(audio_file))
        assert result == audio_file

    def test_validate_nonexistent_file(self):
        """Test validation fails for nonexistent file"""
        with pytest.raises(FileNotFoundError):
            validate_audio_file("/nonexistent/file.mp3")

    def test_validate_unsupported_format(self, tmp_path):
        """Test validation fails for unsupported format"""
        audio_file = tmp_path / "test.xyz"
        audio_file.touch()
        with pytest.raises(ValueError, match="Unsupported audio format"):
            validate_audio_file(str(audio_file))

    def test_validate_directory(self, tmp_path):
        """Test validation fails for directory"""
        with pytest.raises(ValueError, match="Path is not a file"):
            validate_audio_file(str(tmp_path))

    @pytest.mark.parametrize("extension", SUPPORTED_FORMATS)
    def test_validate_supported_formats(self, tmp_path, extension):
        """Test all supported formats are accepted"""
        audio_file = tmp_path / f"test{extension}"
        audio_file.touch()
        result = validate_audio_file(str(audio_file))
        assert result == audio_file


class TestTranscribeAudio:
    """Tests for audio transcription"""

    def test_transcribe_returns_tuple(self):
        """Test that transcribe_audio returns a tuple"""
        # This would require a real audio file or mock
        # Placeholder for now
        pass

    def test_transcribe_invalid_file(self):
        """Test transcription fails for invalid file"""
        with pytest.raises(FileNotFoundError):
            transcribe_audio("/nonexistent/audio.mp3")

    def test_transcribe_unsupported_format(self, tmp_path):
        """Test transcription fails for unsupported format"""
        audio_file = tmp_path / "test.txt"
        audio_file.write_text("not an audio file")
        with pytest.raises(ValueError):
            transcribe_audio(str(audio_file))
