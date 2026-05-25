"""
Tests for the configuration module
"""

from src.config import Config, config


def test_default_config_values():
    """Test that default config returns correct defaults"""
    cfg = Config()
    # Check default audio settings
    assert cfg.get("audio", "default_bpm") == 120.0
    assert cfg.get("audio", "min_bpm") == 40

    # Check default post-processing settings
    assert cfg.get("post_processing", "quantize") is True

    # Check default logger settings
    assert cfg.get("logging", "level") == "INFO"


def test_config_nonexistent_keys():
    """Test that config returns default when section or key is missing"""
    cfg = Config()
    assert cfg.get("nonexistent_section") is None
    assert cfg.get("audio", "nonexistent_key") is None
    assert cfg.get("audio", "nonexistent_key", default=999) == 999


def test_global_config_instance():
    """Test that the global config instance is loaded"""
    assert config is not None
    assert config.get("audio", "default_bpm") == 120.0
