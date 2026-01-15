"""
Tests for the tab generator module
"""
import pytest
from src.tab_generator import TabGenerator, create_tab


class TestTabGenerator:
    """Tests for TabGenerator class"""

    def test_initialization_default(self):
        """Test TabGenerator initialization with defaults"""
        generator = TabGenerator()
        assert generator.num_strings == 6
        assert generator.bpm == 75
        assert generator.bass_threshold == 50

    def test_initialization_custom_bpm(self):
        """Test TabGenerator with custom BPM"""
        generator = TabGenerator(bpm=120)
        assert generator.bpm == 120

    def test_bpm_limits(self):
        """Test BPM is clamped to realistic limits"""
        # Test minimum
        generator = TabGenerator(bpm=10)
        assert generator.bpm == 40

        # Test maximum
        generator = TabGenerator(bpm=300)
        assert generator.bpm == 200

    def test_invalid_tuning(self):
        """Test invalid tuning raises error"""
        with pytest.raises(ValueError):
            TabGenerator(tuning=['InvalidNote'])

    def test_custom_tuning(self):
        """Test custom tuning (Drop D)"""
        drop_d = ['D2', 'A2', 'D3', 'G3', 'B3', 'E4']
        generator = TabGenerator(tuning=drop_d)
        assert generator.num_strings == 6
        # D2 is MIDI note 38
        assert generator.tuning[0] == 38

    def test_find_best_pos_basic(self):
        """Test finding best position for a note"""
        generator = TabGenerator()
        # Middle C (MIDI 60)
        pos = generator.find_best_pos(60)
        assert pos is not None
        string_idx, fret = pos
        assert 0 <= string_idx < 6
        assert 0 <= fret <= 15

    def test_find_best_pos_prefers_low_frets(self):
        """Test that low frets are preferred"""
        generator = TabGenerator()
        # E3 (MIDI 52) should be playable on multiple strings
        # but should prefer open or low frets
        pos = generator.find_best_pos(52)
        assert pos is not None
        _, fret = pos
        # Should prefer frets 0-5
        assert fret <= 5

    def test_generate_ascii_tab_empty(self):
        """Test generating tab with no notes"""
        generator = TabGenerator()
        result = generator.generate_ascii_tab([])
        assert "No notes detected" in result

    def test_generate_ascii_tab_basic(self):
        """Test generating tab with basic notes"""
        generator = TabGenerator(bpm=120)
        notes = [
            {'start': 0.0, 'end': 0.5, 'pitch': 64, 'velocity': 0.8},
            {'start': 0.5, 'end': 1.0, 'pitch': 67, 'velocity': 0.7},
            {'start': 1.0, 'end': 1.5, 'pitch': 60, 'velocity': 0.75},
        ]
        result = generator.generate_ascii_tab(notes)
        assert "🎸" in result
        assert "|" in result  # Tab should have pipe characters
        assert "-" in result  # Tab should have dashes

    def test_detect_chord_empty(self):
        """Test chord detection with no notes"""
        generator = TabGenerator()
        result = generator.detect_chord([])
        assert result == "N.C."

    def test_detect_chord_c_major(self):
        """Test C major chord detection"""
        generator = TabGenerator()
        # C major chord notes (C, E, G)
        notes = [
            {'pitch': 48, 'start': 0.0, 'end': 1.0, 'velocity': 0.8},  # C3
            {'pitch': 52, 'start': 0.0, 'end': 1.0, 'velocity': 0.8},  # E3
            {'pitch': 55, 'start': 0.0, 'end': 1.0, 'velocity': 0.8},  # G3
        ]
        result = generator.detect_chord(notes)
        # Should detect C or a C variant
        assert 'C' in result

    def test_generate_tab_invalid_notes(self):
        """Test tab generation with invalid note format"""
        generator = TabGenerator()
        invalid_notes = [
            {'invalid': 'data'},
        ]
        with pytest.raises((ValueError, RuntimeError, KeyError)):
            generator.generate_ascii_tab(invalid_notes)


class TestCreateTab:
    """Tests for create_tab convenience function"""

    def test_create_tab_basic(self):
        """Test create_tab function"""
        notes = [
            {'start': 0.0, 'end': 0.5, 'pitch': 60, 'velocity': 0.8},
        ]
        result = create_tab(notes, bpm=100)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_create_tab_custom_bpm(self):
        """Test create_tab with custom BPM"""
        notes = [
            {'start': 0.0, 'end': 0.5, 'pitch': 60, 'velocity': 0.8},
        ]
        result = create_tab(notes, bpm=140)
        assert "140" in result or "140.0" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
