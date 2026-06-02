# Contributing to JustJam

First off, thank you for considering contributing to JustJam! It's people like you that make this platform better for everyone.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)

---

## Code of Conduct

This project and everyone participating in it is governed by a code of conduct. By participating, you are expected to uphold this code. Please be respectful and constructive in all interactions.

---

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
2. With files '...'
3. See error

**Expected behavior**
A clear description of what you expected to happen.

**Actual behavior**
What actually happened.

**Environment:**
 - OS: [e.g. macOS 13.0, Ubuntu 22.04]
 - Python version: [e.g. 3.10.5]
 - Project version: [e.g. 1.1.0]

**Additional context**
Add any other context about the problem here.
```

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:
- **Clear title** describing the enhancement
- **Detailed description** of the proposed functionality
- **Use cases** explaining why this would be useful
- **Possible implementation** if you have ideas

---

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/JustJam.git
cd JustJam

# Add upstream remote
git remote add upstream https://github.com/blooper20/JustJam.git
```

### 2. Create a Virtual Environment (Backend)

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies & Build

```bash
# Install backend dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Install client dependencies
cd client
npm install
```

---

## Coding Standards

We follow strict automated coding rules and formatting standards to guarantee stability and prevent build breakages. Refer to [AGENTS.md](./AGENTS.md) for detailed developer regulations.

### Backend (Python)
- **Formatting**: We use `black` for formatting with a line length limit of **100**.
  ```bash
  black src/ tests/
  ```
- **Import Sorting**: Use `isort` with the black profile.
  ```bash
  isort src/ tests/
  ```
- **Linting**: Check with `flake8` to catch syntactic errors.
  ```bash
  flake8 src/ tests/
  ```
- **Static Type Check**: Check type mappings using `mypy`.
  ```bash
  mypy src/
  ```

### Frontend (Next.js / TypeScript)
- **Linting**: Next.js uses strict ESLint rules.
  ```bash
  cd client && npm run lint
  ```
- **Formatting**: We use Prettier to format TSX/TS/CSS files.
  ```bash
  cd client && npx prettier --write "app/**/*.{ts,tsx}" "components/**/*.{ts,tsx}" "lib/**/*.{ts,tsx}"
  ```

---

## Testing Guidelines

Ensure all tests pass before proposing updates or pull requests.

### Running Backend Tests
```bash
# Run pytest tests
pytest

# Check coverage
pytest --cov=src tests/
```

### Running Frontend Tests
```bash
# Jest unit tests
cd client && npm run test

# Playwright E2E tests
cd client && npx playwright test
```

---

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

---

Thank you for contributing to JustJam! 🎸
