import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# SQLAlchemy 2.x dropped the bare ``postgres://`` alias; normalize the Heroku/Neon-style
# scheme so either form works regardless of how the platform sets DATABASE_URL.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

# Mirror brain-svc: a small pooled engine with pre-ping so a recycled Postgres
# connection (the dev container reclaims them) heals on the next checkout.
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5) if DATABASE_URL else None
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
