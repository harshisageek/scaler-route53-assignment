from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.record_set import TTL_MAX
from app.services.aws_regions import AWS_REGIONS

RecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"]
EditableRecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"]
RecordSetSort = Literal["name", "-name", "type", "-type", "ttl", "-ttl"]
RoutingPolicy = Literal["simple", "weighted", "failover", "latency", "geolocation", "multivalue"]
FailoverRole = Literal["PRIMARY", "SECONDARY"]


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
    routing_policy: RoutingPolicy = "simple"
    set_identifier: str | None = Field(default=None, min_length=1, max_length=128)
    weight: int | None = Field(default=None, ge=0, le=255)
    failover_role: FailoverRole | None = None
    region: str | None = Field(default=None, max_length=32)
    geolocation: str | None = Field(default=None, max_length=64)

    @field_validator("values")
    @classmethod
    def _values_are_not_blank(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value for value in cleaned):
            raise ValueError("Record values cannot be blank.")
        if any(len(value) > 4096 for value in cleaned):
            raise ValueError("A record value can have at most 4096 characters.")
        return cleaned

    @field_validator("set_identifier", "geolocation")
    @classmethod
    def _trim_optional_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @model_validator(mode="after")
    def _policy_fields_match(self) -> Self:
        requires_identifier = self.routing_policy in {
            "weighted",
            "failover",
            "latency",
            "geolocation",
        }
        if requires_identifier and not self.set_identifier:
            raise ValueError("This routing policy requires a set identifier.")
        if not requires_identifier and self.set_identifier is not None:
            raise ValueError("Simple and multivalue records do not use a set identifier.")

        expected = {
            "weighted": ("weight", self.weight),
            "failover": ("failover_role", self.failover_role),
            "latency": ("region", self.region),
            "geolocation": ("geolocation", self.geolocation),
        }
        if self.routing_policy in expected:
            label, value = expected[self.routing_policy]
            if value is None or value == "":
                raise ValueError(f"The {self.routing_policy} routing policy requires {label}.")

        policy_fields = {
            "weight": self.weight,
            "failover_role": self.failover_role,
            "region": self.region,
            "geolocation": self.geolocation,
        }
        allowed = expected.get(self.routing_policy, (None, None))[0]
        if any(value is not None and field != allowed for field, value in policy_fields.items()):
            raise ValueError(
                f"Only fields for the {self.routing_policy} routing policy are allowed."
            )
        if self.region is not None and self.region not in AWS_REGIONS:
            raise ValueError("Choose an AWS Region from the list.")
        return self


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
    routing_policy: RoutingPolicy
    set_identifier: str | None
    weight: int | None
    failover_role: FailoverRole | None
    region: str | None
    geolocation: str | None
    created_at: datetime
    updated_at: datetime

    @field_validator("set_identifier", mode="before")
    @classmethod
    def _empty_identifier_is_none(cls, value: str | None) -> str | None:
        return value or None


class RecordSetListParams(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    q: str | None = Field(
        default=None,
        max_length=255,
        description="Case-insensitive text to find in the record name or value.",
    )
    record_type: RecordType | None = Field(default=None, alias="type")
    routing_policy: RoutingPolicy | None = None
    sort: RecordSetSort = "name"
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=100, ge=1, le=100)


class RecordSetList(BaseModel):
    items: list[RecordSetOut]
    total: int
    page: int
    page_size: int
