# 🤖 AGENTS.md: Developer Guidelines & Code of Conduct

Welcome, Agent. This document outlines the strict engineering guidelines, quality standards, and verification protocols required for all AI sub-agents collaborating on the **JustJam** codebase. 

Adherence to these rules is non-negotiable. Our development workflow enforces a zero-tolerance policy for syntax warnings, untyped logic, untested paths, and build failures.

---

## 🧭 Core Principles

1. **Self-Correction Prior to Submission**: Do not request human review for issues that can be caught programmatically. Check your work using local verification tools.
2. **No Placeholders**: Never write placeholder functions (`// TODO`, `pass`) or mock endpoints unless explicitly instructed. Every line you write must be functional and production-grade.
3. **Preserve Domain Logic**: Do not degrade the core DSP or transcription heuristics (such as the open-position prior, chord matching, or beat quantization rules) when refactoring audio code.

---

## 🛠 Coding Standard & Linting

Before reporting a task complete, you **must** run the following tools and resolve all errors.

### Backend (Python)
- **Formatting**: `black` is configured for a line length of **100**. Run it with:
  ```bash
  black src/ tests/
  ```
- **Import Sorting**: Use `isort` with the black profile:
  ```bash
  isort src/ tests/
  ```
- **Linting**: Run `flake8` to catch syntactic anomalies:
  ```bash
  flake8 src/ tests/
  ```
- **Static Type Check**: Run `mypy` to verify type hints:
  ```bash
  mypy src/
  ```

### Frontend (Next.js & TypeScript)
- **Linting & Rules**: Next.js uses strict ESLint rules. Verify with:
  ```bash
  cd client && npm run lint
  ```
- **Formatting**: Format TSX/TS/CSS files via Prettier:
  ```bash
  cd client && npx prettier --write "app/**/*.{ts,tsx}" "components/**/*.{ts,tsx}" "lib/**/*.{ts,tsx}"
  ```

---

## 🧪 Testing Protocol

You are required to verify your modifications using the test suite. All tests must pass.

### Backend Testing
- Run the full pytest suite:
  ```bash
  pytest
  ```
- Ensure coverage does not degrade. Run:
  ```bash
  pytest --cov=src tests/
  ```

### Frontend Testing
- **Unit & Integration**: Run Jest tests:
  ```bash
  cd client && npm run test
  ```
- **End-to-End (E2E)**: Run Playwright tests to check UI and interaction regressions:
  ```bash
  cd client && npx playwright test
  ```

---

## 📦 Build Verification

Always verify that your changes compile and bundle successfully without production warnings.

### Frontend Production Build
```bash
cd client
npm run build
```
Any hydration warnings, React v19 deprecations, or TypeScript compiler errors in the build log will result in an immediate rejection.

---

## 📝 Reporting Protocol

When submitting a task for review, your final message **must** contain a verification report summarizing the outcomes of the commands run above. Use the following template:

```markdown
### 🤖 Verification Report

- **Linting Verification**:
  - [x] Python `black` & `flake8` passed.
  - [x] Next.js ESLint / Prettier checked.
- **Test Suite Results**:
  - [x] Backend tests passed (N tests run).
  - [x] Frontend Jest tests passed.
- **Build Status**:
  - [x] Next.js build completed successfully.
- **Summary of Changes**:
  - (Describe exactly what was modified, which files were touched, and any design choices made).
```

Failure to execute these checks or provide this report is considered a task failure. Be meticulous.
