# Contributing to Fingerstyle Tab MCP Server

First off, thank you for considering contributing to Fingerstyle Tab MCP Server! It's people like you that make this tool better for everyone.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)

## Code of Conduct

This project and everyone participating in it is governed by a code of conduct. By participating, you are expected to uphold this code. Please be respectful and constructive in all interactions.

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

**Bug Report Template:**

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Run command '...'
2. With audio file '...'
3. See error

**Expected behavior**
A clear description of what you expected to happen.

**Actual behavior**
What actually happened.

**Environment:**
 - OS: [e.g. macOS 13.0, Ubuntu 22.04]
 - Python version: [e.g. 3.10.5]
 - Project version: [e.g. 0.1.0]

**Audio file details** (if applicable):
 - Format: [e.g. MP3, WAV]
 - Duration: [e.g. 30 seconds]
 - Sample rate: [e.g. 44.1kHz]

**Additional context**
Add any other context about the problem here.
```

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Clear title** describing the enhancement
- **Detailed description** of the proposed functionality
- **Use cases** explaining why this would be useful
- **Possible implementation** if you have ideas

### 🎵 Contributing Code

We love code contributions! Here are the areas where we particularly need help:

- **Chord Detection**: Improving accuracy of chord recognition
- **Fingering Logic**: Enhancing the smart fingering algorithm
- **Performance**: Optimizing audio processing speed
- **Documentation**: Improving code comments and user documentation
- **Testing**: Adding test coverage
- **Internationalization**: Adding translations for new languages

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/fingerstyle-tab-mcp.git
cd fingerstyle-tab-mcp

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL-OWNER/fingerstyle-tab-mcp.git
```

### 2. Create a Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
# Install the package in development mode with dev dependencies
pip install -e ".[dev]"
```

### 4. Create a Branch

```bash
# Create a new branch for your feature or bugfix
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bugfix-name
```

## Coding Standards

### Python Style Guide

We follow [PEP 8](https://pep8.org/) with some modifications:

- **Line length**: 100 characters (not 79)
- **Quotes**: Use double quotes for strings
- **Imports**: Group imports (standard library, third-party, local)

### Code Formatting

We use automated tools to maintain code quality:

```bash
# Format code with black
black src/ tests/

# Sort imports with isort
isort src/ tests/

# Check code with flake8
flake8 src/ tests/

# Type checking with mypy
mypy src/
```

### Code Style Requirements

1. **Type Hints**: Use type hints for function parameters and return values
   ```python
   def process_audio(file_path: str, bpm: float = 120.0) -> Tuple[List[Dict], float]:
       pass
   ```

2. **Docstrings**: Use Google-style docstrings for all public functions and classes
   ```python
   def generate_tab(notes: List[Dict]) -> str:
       """
       Generate ASCII tablature from notes.

       Args:
           notes: List of note dictionaries with pitch, start, end, velocity

       Returns:
           ASCII tablature string

       Raises:
           ValueError: If notes list is empty or invalid
       """
       pass
   ```

3. **Error Handling**: Always handle errors gracefully with specific exceptions
   ```python
   try:
       result = process_file(path)
   except FileNotFoundError:
       logger.error(f"File not found: {path}")
       raise
   except ValueError as e:
       logger.error(f"Invalid file format: {e}")
       raise
   ```

4. **Logging**: Use the logging module instead of print statements
   ```python
   import logging
   logger = logging.getLogger(__name__)
   logger.info("Processing audio file")
   ```

## Testing Guidelines

### Writing Tests

- Place tests in the `tests/` directory
- Name test files as `test_<module_name>.py`
- Use pytest fixtures for common setup
- Aim for >80% code coverage

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_tab_generator.py

# Run specific test
pytest tests/test_tab_generator.py::TestTabGenerator::test_initialization_default
```

### Test Structure Example

```python
import pytest
from src.module import function

class TestFunction:
    """Tests for function"""

    def test_basic_case(self):
        """Test basic functionality"""
        result = function(input_data)
        assert result == expected_output

    def test_edge_case(self):
        """Test edge case"""
        with pytest.raises(ValueError):
            function(invalid_input)

    @pytest.fixture
    def sample_data(self):
        """Fixture providing sample data"""
        return {"key": "value"}

    def test_with_fixture(self, sample_data):
        """Test using fixture"""
        result = function(sample_data)
        assert result is not None
```

## Submitting Changes

### Commit Messages

Write clear, concise commit messages following this format:

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Example:**
```
feat: add support for Drop D tuning

- Added custom tuning parameter to TabGenerator
- Updated chord templates for alternate tunings
- Added tests for tuning validation

Closes #42
```

### Pull Request Process

1. **Update Documentation**: Update README.md if you're adding features
2. **Add Tests**: Ensure your changes are covered by tests
3. **Run Tests**: Make sure all tests pass
4. **Update CHANGELOG**: Add entry describing your changes
5. **Code Quality**: Run formatters and linters

```bash
# Before submitting PR
black src/ tests/
isort src/ tests/
flake8 src/ tests/
mypy src/
pytest --cov=src
```

6. **Submit PR**: Push your branch and create a Pull Request

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, your PR will be merged

## Project Structure

Understanding the codebase:

```
src/
├── transcriber.py      # Audio → Notes (Basic Pitch + Librosa)
├── tab_generator.py    # Notes → Tablature (Chord detection + fingering)
├── config.py           # Configuration management
└── __init__.py

tests/
├── test_transcriber.py
├── test_tab_generator.py
└── test_config.py

mcp_server.py          # MCP protocol implementation
test_workflow.py       # CLI testing tool
```

## Internationalization (i18n)

When adding user-facing strings, use gettext:

```python
from gettext import gettext as _

message = _("Error: File not found")
```

Then update translation files:

```bash
# Extract strings
xgettext -o locales/messages.pot src/*.py

# Update translations
msgmerge --update locales/ko/LC_MESSAGES/messages.po locales/messages.pot

# Compile
msgfmt locales/ko/LC_MESSAGES/messages.po -o locales/ko/LC_MESSAGES/messages.mo
```

## Getting Help

- 💬 [GitHub Discussions](https://github.com/yourusername/fingerstyle-tab-mcp/discussions) - Ask questions
- 📧 Email maintainers (see README.md)
- 📖 Read existing issues and PRs for context

## Recognition

Contributors will be recognized in:
- README.md Contributors section
- Release notes
- Git history

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Fingerstyle Tab MCP Server! 🎸
