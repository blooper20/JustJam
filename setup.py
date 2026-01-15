"""
Fingerstyle Tab MCP Server - Setup Configuration
"""
from setuptools import setup, find_packages
from pathlib import Path

# Read the contents of README file
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding='utf-8')

setup(
    name="fingerstyle-tab-mcp",
    version="0.1.0",
    description="AI-powered MCP server that converts guitar audio recordings into fingerstyle tablature",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Your Name",
    author_email="your.email@example.com",
    url="https://github.com/yourusername/fingerstyle-tab-mcp",
    license="MIT",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "mcp>=1.0.0",
        "basic-pitch>=0.2.5",
        "librosa>=0.10.0",
        "tensorflow>=2.13.0",
        "numpy>=1.24.0,<2.0.0",
        "pydub>=0.25.1",
        "music21>=9.1.0",
        "pyyaml>=6.0.1",
        "python-dotenv>=1.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.4.0",
            "pytest-cov>=4.1.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
            "mypy>=1.5.0",
            "isort>=5.12.0",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Intended Audience :: End Users/Desktop",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Multimedia :: Sound/Audio :: Analysis",
        "Topic :: Multimedia :: Sound/Audio :: Conversion",
    ],
    keywords="guitar tablature music-transcription audio-analysis mcp ai",
    entry_points={
        "console_scripts": [
            "fingerstyle-tab=test_workflow:main",
        ],
    },
    include_package_data=True,
    package_data={
        "": ["locales/**/*.po", "locales/**/*.mo"],
    },
)
