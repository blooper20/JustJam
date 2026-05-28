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

## 🛡️ Codebase Ratchet Rules (Rules #402 - #408)

All development processes must strictly comply with the following evolutionary codebase protection rules:

### 🛡️ Rule #402: Web Audio API / WaveSurfer Browser Sandbox Principle
- Browser-only APIs such as `AudioContext`, `WaveSurfer`, or DOM globals (`window`, `document`) must NEVER be accessed or initialized during Node.js Server-Side Rendering (SSR) or build time.
- Standardize the usage of `dynamic(() => import(...), { ssr: false })` when importing components that load these APIs.
- Protect component execution by guarding with an `isMounted` state initialized in `useEffect`, or by explicitly checking `typeof window !== 'undefined'`.

### 🛡️ Rule #403 & #404: CI/CD Pipeline Cache & Dependency Defense
- In GitHub Actions YAML configurations, ensure that `actions/cache@v4` and `actions/upload-artifact` always receive valid, non-null paths to prevent CI failures.
- Specify `shell: bash` explicitly for all terminal commands in CI workflows to eliminate OS-specific runner discrepancies.
- Define `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` in the environment to suppress Node.js 20 deprecation warnings.

### 🛡️ Rule #405: API-Test Code Schema Integrity Sync
- When changing REST API schemas (e.g. Pydantic request/response models, SQLAlchemy columns), you must simultaneously patch the corresponding integration tests (e.g. `tests/test_project_routes.py`, `test_workflow.py`).
- Always run `pytest` and `flake8` locally before pushing to prevent CI breakage.

### 🛡️ Rule #406: Next.js Build-Time Conditional Compiler Directive Prevention
- Standalone `@ts-expect-error` or `@ts-ignore` comments without lint suppression might fail in production builds if compiler environments differ.
- Use `as any` casting alongside explicit ESLint disable comments (e.g., `// eslint-disable-next-line @typescript-eslint/no-explicit-any`) to bypass strict type mappings without breaking build-time compiler directives.

### 🛡️ Rule #407: Mypy Explicit Package Bases & Static Type Integrity
- Set `explicit_package_bases = true` in `pyproject.toml` to prevent namespace conflicts where modules share duplicate names.
- Always use standard type annotations for SQLAlchemy columns and Pydantic schema mappings to ensure static type checking matches run-time attributes.

### 🛡️ Rule #408: Next.js 16 Turbopack Backward Compatibility & Proxy Transition
- Ensure the production build (`npm run build`) runs without any deprecation warnings.
- Deprecated configurations like legacy `middleware.ts` routing rules must be transitioned to the new `proxy` configuration as mandated by the Next.js Turbopack upgrade.

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
