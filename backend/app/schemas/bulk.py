from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.record_set import RecordSetInput


class RecordSetChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["CREATE", "UPSERT", "DELETE"]
    record_set_id: int | None = Field(default=None, ge=1)
    record_set: RecordSetInput | None = None

    @model_validator(mode="after")
    def _fields_match_action(self) -> Self:
        if self.action == "CREATE":
            if self.record_set_id is not None or self.record_set is None:
                raise ValueError("CREATE requires record_set and no record_set_id.")
        elif self.action == "UPSERT":
            if self.record_set_id is None or self.record_set is None:
                raise ValueError("UPSERT requires record_set_id and record_set.")
        elif self.record_set_id is None or self.record_set is not None:
            raise ValueError("DELETE requires record_set_id and no record_set.")
        return self


class RecordSetChangeBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    changes: list[RecordSetChange] = Field(min_length=1, max_length=100)


class BatchResult(BaseModel):
    applied_count: int


class HostedZoneDeleteBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hosted_zone_ids: list[str] = Field(min_length=1, max_length=100)


class HostedZoneDeleteResult(BaseModel):
    deleted_count: int
