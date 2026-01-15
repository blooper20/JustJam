from typing import Dict, List
from src.api.schemas.project import Project

# 현재는 간단한 인메모리 저장소 사용
# 키: 프로젝트 ID (문자열)
projects_db: Dict[str, Project] = {}
