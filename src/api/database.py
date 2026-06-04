import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Use DATABASE_URL from env if available, otherwise default to sqlite in temp dir
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not SQLALCHEMY_DATABASE_URL:
    DB_PATH = os.path.join(PROJECT_ROOT, "temp", "justjam.db")
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")  # 64MB cache
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_and_upgrade_schema(db_engine):
    from sqlalchemy import inspect, text

    inspector = inspect(db_engine)
    if "practice_logs" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("practice_logs")]
        with db_engine.begin() as conn:
            if "raw_video_url" not in columns:
                conn.execute(text("ALTER TABLE practice_logs ADD COLUMN raw_video_url VARCHAR"))
            if "start_time" not in columns:
                conn.execute(text("ALTER TABLE practice_logs ADD COLUMN start_time FLOAT"))
            if "overlay_text" not in columns:
                conn.execute(text("ALTER TABLE practice_logs ADD COLUMN overlay_text VARCHAR"))
