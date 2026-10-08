from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.record_set import TTL_MAX

RecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"]
EditableRecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"]
RecordSetSort = Literal["name", "-name", "type", "-type", "ttl", "-ttl"]


class RecordSetInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        max_length=255,
        description="A name relative to the zone, an absolute name, or @ for the zone apex.",
        examples=["www"],
    )
    type: EditableRecordType
    ttl: int = Field(ge=0, le=TTL_MAX, examples=[300])
    values: list[str] = Field(min_length=1, max_length=100)

    @field_validator("values")
    @classmethod
    def _values_are_not_blank(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value for value in cleaned):
            raise ValueError("Record values cannot be blank.")
        if any(len(value) > 4096 for value in cleaned):
            raise ValueError("A record value can have at most 4096 characters.")
        return cleaned


class RecordSetCreate(RecordSetInput):
    pass


class RecordSetUpdate(RecordSetInput):
    pass


class RecordSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: RecordType
    ttl: int
    values: list[str]
    created_at: datetime
    updated_at: datetime


class RecordSetListParams(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    q: str | None = Field(
        default=None,
        max_length=255,
        description="Case-insensitive text to find in the record name or value.",
    )
    record_type: RecordType | None = Field(default=None, alias="type")
    sort: RecordSetSort = "name"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=100, ge=1, le=100)


class RecordSetList(BaseModel):
    items: list[RecordSetOut]
    total: int
    page: int
    page_size: int
