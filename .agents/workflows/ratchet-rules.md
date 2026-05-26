# Ratchet Rules

## Rules

### Ratchet Rule #404
> "Ratchet Rule #404: GitHub Actions YAML 파일 수정 시, 기존 액션 플러그인이 요구하는 필수 인자(예: path)를 절대 삭제하지 않도록 주의해야 하며, Node.js 20 deprecation 로그가 보일 경우 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`를 적용하여 노이즈를 제거한다."

### Ratchet Rule #405
> "Ratchet Rule #405: 백엔드 API 스키마(`projects.py`)를 변경하여 프론트엔드와 동기화할 경우, 반드시 관련된 백엔드 통합 테스트(`test_workflow.py` 등)의 검증 로직도 함께 업데이트해야 한다. 또한 모든 변경 사항은 커밋 전 샌드박스 내에서 `flake8` 등 로컬 린트를 완벽히 통과해야 Exit Code 1로 인한 CI/CD 붕괴를 막을 수 있다."
