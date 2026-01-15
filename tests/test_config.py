"""
Tests for the configuration module
"""
import pytest
import yaml
from pathlib import Path
from src.config import (
    Config, AudioConfig, TablatureConfig, ChordDetectionConfig,
    LoggingConfig, I18nConfig, MCPConfig, get_config, reload_config
)


class TestAudioConfig:
    """Tests for AudioConfig"""

    def test_default_values(self):
        """Test default audio configuration"""
        config = AudioConfig()
        assert '.mp3' in config.supported_formats
        assert config.default_bpm == 120.0
        assert config.min_bpm == 40
        assert config.max_bpm == 200


class TestTablatureConfig:
    """Tests for TablatureConfig"""

    def test_default_values(self):
        """Test default tablature configuration"""
        config = TablatureConfig()
        assert config.standard_tuning == ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
        assert config.bass_threshold == 50
        assert config.slots_per_measure == 16


class TestConfig:
    """Tests for main Config class"""

    def test_default_initialization(self):
        """Test Config with default values"""
        config = Config()
        assert isinstance(config.audio, AudioConfig)
        assert isinstance(config.tablature, TablatureConfig)
        assert isinstance(config.chord_detection, ChordDetectionConfig)
        assert isinstance(config.logging, LoggingConfig)
        assert isinstance(config.i18n, I18nConfig)
        assert isinstance(config.mcp, MCPConfig)

    def test_from_yaml_nonexistent(self):
        """Test loading from nonexistent file"""
        with pytest.raises(FileNotFoundError):
            Config.from_yaml("/nonexistent/config.yaml")

    def test_from_yaml_valid(self, tmp_path):
        """Test loading from valid YAML file"""
        config_file = tmp_path / "config.yaml"
        config_data = {
            'audio': {'default_bpm': 100.0},
            'tablature': {'bass_threshold': 60},
            'logging': {'level': 'DEBUG'},
        }
        config_file.write_text(yaml.dump(config_data))

        config = Config.from_yaml(str(config_file))
        assert config.audio.default_bpm == 100.0
        assert config.tablature.bass_threshold == 60
        assert config.logging.level == 'DEBUG'

    def test_from_yaml_empty(self, tmp_path):
        """Test loading from empty YAML file"""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("")

        config = Config.from_yaml(str(config_file))
        # Should use defaults
        assert config.audio.default_bpm == 120.0

    def test_from_yaml_invalid(self, tmp_path):
        """Test loading from invalid YAML"""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("invalid: yaml: content: ::::")

        with pytest.raises(ValueError, match="Invalid YAML"):
            Config.from_yaml(str(config_file))

    def test_to_dict(self):
        """Test converting config to dictionary"""
        config = Config()
        result = config.to_dict()
        assert isinstance(result, dict)
        assert 'audio' in result
        assert 'tablature' in result
        assert 'logging' in result

    def test_load_no_file(self, tmp_path, monkeypatch):
        """Test load with no config file"""
        # Change to a directory with no config.yaml
        monkeypatch.chdir(tmp_path)
        config = Config.load()
        # Should return defaults
        assert config.audio.default_bpm == 120.0

    def test_load_with_path(self, tmp_path):
        """Test load with specific path"""
        config_file = tmp_path / "custom.yaml"
        config_data = {'audio': {'default_bpm': 150.0}}
        config_file.write_text(yaml.dump(config_data))

        config = Config.load(str(config_file))
        assert config.audio.default_bpm == 150.0


class TestGlobalConfig:
    """Tests for global configuration functions"""

    def test_get_config(self):
        """Test get_config returns Config instance"""
        config = get_config()
        assert isinstance(config, Config)

    def test_reload_config(self, tmp_path):
        """Test reload_config"""
        config_file = tmp_path / "config.yaml"
        config_data = {'audio': {'default_bpm': 90.0}}
        config_file.write_text(yaml.dump(config_data))

        config = reload_config(str(config_file))
        assert config.audio.default_bpm == 90.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
