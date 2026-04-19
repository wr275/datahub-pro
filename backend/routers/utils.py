"""
Shared router helpers. Mirrors the file-loading logic used in
analytics.py / calculated_fields.py so every router reads uploaded files
through a single code path.
"""
import os
from typing import Optional

from database import DataFile
from config import settings


def load_file_bytes(f: DataFile) -> Optional[bytes]:
    """
    Return raw bytes for a DataFile, regardless of where it's stored:
      1) in-DB (file_content BYTEA)
      2) local disk (LOCAL_UPLOAD_DIR)
      3) R2 / S3 (s3_key)
    Returns None if no bytes can be located.
    """
    if f is None:
        return None

    # 1) In-database storage (default for new uploads)
    if getattr(f, "file_content", None):
        try:
            return bytes(f.file_content)
        except Exception:
            pass

    # 2) Local disk
    try:
        path = os.path.join(settings.LOCAL_UPLOAD_DIR, f.filename)
        if os.path.exists(path):
            with open(path, "rb") as fp:
                return fp.read()
    except Exception:
        pass

    # 3) R2 / S3
    if getattr(f, "s3_key", None) and getattr(f, "storage_type", "local") in ("r2", "s3"):
        try:
            from routers.files import get_file_r2
            return get_file_r2(f.s3_key)
        except Exception:
            pass

    return None
