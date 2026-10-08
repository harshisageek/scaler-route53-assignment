from typing import Literal

from pydantic import BaseModel


class BindImportRecord(BaseModel):
    name: str
    type: str
    ttl: int
    values: list[str]
    status: Literal["add", "already_present", "unsupported"]
    reason: str | None = None


class BindImportPreview(BaseModel):
    file_name: str
    records: list[BindImportRecord]
    add_count: int
    already_present_count: int
    unsupported_count: int


class BindImportResult(BaseModel):
    imported_count: int
    skipped_count: int
