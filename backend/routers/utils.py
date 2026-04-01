"""Shared utilities for file loading across routers."""

from __future__ import annotations

import os
import io
from fastapi import HTTPException
from database import DataFile
from config import settings


def load_file_bytes(f: DataFile) -> bytes:
    """Load raw file bytes from BYTEA column, local disk, or R2/S3.

    Priority:
    1. Inline BYTEA in DB (legacy local-upload path)
    2. R2 / S3 object store
    3. Local disk (settings.LOCAL_UPLOAD_DIR)
    """
    # 1. Inline DB blob (may be present for legacy rows)
    if f.file_content:
        return bytes(f.file_content)

    # 2. Object storage (R2 / S3)
    if f.storage_type == "s3" and f.s3_key:
        import boto3
        s3 = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            endpoint_url=settings.AWS_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        response = s3.get_object(Bucket=settings.AWS_BUCKET_NAME, Key=f.s3_key)
        return response["Body"].read()

    # 3. Local disk
    path = os.path.join(settings.LOCAL_UPLOAD_DIR, f.filename)
    if os.path.exists(path):
        with open(path, "rb") as fp:
            return fp.read()

    raise HTTPException(
        status_code=404,
        detail="File content not available. Please re-upload.",
    )
