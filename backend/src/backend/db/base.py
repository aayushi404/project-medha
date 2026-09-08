from datetime import datetime

from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    # ddl.sql uses `timestamptz` for every timestamp column; map plain
    # `datetime` here so models don't need to spell out timezone=True each time.
    type_annotation_map = {
        datetime: TIMESTAMP(timezone=True),
    }
