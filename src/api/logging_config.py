import logging
import os
import sys
from logging.handlers import RotatingFileHandler


def setup_logging():
    # 로그 디렉토리 생성
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    log_dir = os.path.join(project_root, "logs")
    os.makedirs(log_dir, exist_ok=True)

    logger = logging.getLogger("justjam")
    logger.setLevel(logging.INFO)

    # 이미 핸들러가 설정되어 있으면 중복 추가 방지
    if logger.handlers:
        return logger

    # 콘솔 핸들러
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(
        logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    )

    # 파일 핸들러 (로테이션)
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, "justjam.log"),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    )

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


# 싱글톤처럼 사용하기 위한 전역 로거 인스턴스
logger = setup_logging()
