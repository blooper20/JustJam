from typing import Any, Dict, Optional

from fastapi import HTTPException, status


class JustJamException(HTTPException):
    """JustJam 전용 기본 예외 클래스"""

    def __init__(
        self, status_code: int, detail: Any = None, headers: Optional[Dict[str, str]] = None
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)


class AudioProcessingError(JustJamException):
    """음원 처리 중 에러 발생 시"""

    def __init__(self, detail: str = "음원 처리 중 오류가 발생했습니다."):
        super().__init__(status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


class TranscriptionError(JustJamException):
    """AI 채보(Transcription) 중 에러 발생 시"""

    def __init__(self, detail: str = "AI 채보 중 오류가 발생했습니다."):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)


class InsufficientQuotaError(JustJamException):
    """사용자 할당량 초과 시"""

    def __init__(self, detail: str = "사용 가능한 할당량을 초과했습니다."):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ProjectNotFoundError(JustJamException):
    """프로젝트를 찾을 수 없을 때"""

    def __init__(self, detail: str = "프로젝트를 찾을 수 없습니다."):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class InvalidTokenError(JustJamException):
    """유효하지 않은 토큰일 때"""

    def __init__(self, detail: str = "유효하지 않은 토큰입니다."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class AuthenticationError(JustJamException):
    """인증 실패 시"""

    def __init__(self, detail: str = "인증에 실패했습니다."):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class UserNotFoundError(JustJamException):
    """사용자를 찾을 수 없을 때"""

    def __init__(self, detail: str = "사용자를 찾을 수 없습니다."):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
