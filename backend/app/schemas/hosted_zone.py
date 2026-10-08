from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.models.hosted_zone import COMMENT_MAX_LENGTH
from app.models.hosted_zone_tag import TAG_KEY_MAX_LENGTH, TAG_VALUE_MAX_LENGTH
from app.services.aws_regions import AWS_REGIONS
from app.services.validation.domain_names import InvalidDomainNameError, normalize_zone_name


class Vpc(BaseModel):
    """A mocked VPC. Nothing is looked up; the values only have to look right."""

    region: str = Field(examples=["us-east-1"], json_schema_extra={"enum": list(AWS_REGIONS)})
    vpc_id: str = Field(pattern=r"^vpc-[0-9a-f]{8}(?:[0-9a-f]{9})?$", examples=["vpc-0a1b2c3d"])

    @field_validator("region")
    @classmethod
    def _known_region(cls, value: str) -> str:
        if value not in AWS_REGIONS:
            raise PydanticCustomError("unknown_region", "Choose an AWS Region from the list.")
        return value


class HostedZoneTag(BaseModel):
    key: str = Field(min_length=1, max_length=TAG_KEY_MAX_LENGTH)
    value: str = Field(default="", max_length=TAG_VALUE_MAX_LENGTH)

    @field_validator("key")
    @classmethod
    def _valid_key(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise PydanticCustomError("empty_tag_key", "Enter a tag key.")
        if value.lower().startswith("aws:"):
            raise PydanticCustomError(
                "reserved_tag_key",
                "Tag keys cannot start with the reserved aws: prefix.",
            )
        return value

    @field_validator("value")
    @classmethod
    def _trim_value(cls, value: str) -> str:
        return value.strip()


def _unique_tags(tags: list[HostedZoneTag]) -> list[HostedZoneTag]:
    keys = [tag.key for tag in tags]
    if len(keys) != len(set(keys)):
        raise PydanticCustomError("duplicate_tag_key", "Each tag key must be unique.")
    return tags


class HostedZoneCreate(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"name": "example.com", "comment": "Production zone", "private_zone": False},
                {
                    "name": "internal.example.com",
                    "private_zone": True,
                    "vpc": {"region": "us-east-1", "vpc_id": "vpc-0a1b2c3d"},
                },
            ]
        }
    )

    name: str = Field(
        max_length=1024,
        description="Domain name. Case, a trailing dot and surrounding spaces don't matter.",
    )
    comment: str | None = Field(default=None, max_length=COMMENT_MAX_LENGTH)
    private_zone: bool = False
    vpc: Vpc | None = Field(default=None, description="Required for private zones only.")
    tags: list[HostedZoneTag] = Field(default_factory=list, max_length=50)

    @field_validator("name")
    @classmethod
    def _canonical_name(cls, value: str) -> str:
        try:
            return normalize_zone_name(value)
        except InvalidDomainNameError as error:
            raise PydanticCustomError("invalid_domain_name", str(error)) from None

    @field_validator("comment")
    @classmethod
    def _blank_comment_is_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def _vpc_matches_type(self) -> Self:
        if self.private_zone and self.vpc is None:
            raise PydanticCustomError("vpc_required", "A private hosted zone needs a VPC.")
        if not self.private_zone and self.vpc is not None:
            raise PydanticCustomError("vpc_not_allowed", "Only private hosted zones have a VPC.")
        _unique_tags(self.tags)
        return self


class HostedZoneOut(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "Z0812345ABCDEFGHIJKLM",
                    "name": "example.com.",
                    "comment": "Production zone",
                    "private_zone": False,
                    "record_count": 2,
                    "created_at": "2026-10-01T12:00:00Z",
                }
            ]
        },
    )

    id: str = Field(description="Route 53 style hosted zone ID.")
    name: str = Field(description="Fully qualified domain name, with the trailing dot.")
    comment: str | None
    private_zone: bool
    record_count: int = Field(description="Record sets in the zone, including NS and SOA.")
    tags: list[HostedZoneTag] = Field(default_factory=list)
    created_at: datetime


class HostedZoneDetail(HostedZoneOut):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "id": "Z0812345ABCDEFGHIJKLM",
                    "name": "example.com.",
                    "comment": "Production zone",
                    "private_zone": False,
                    "record_count": 2,
                    "created_at": "2026-10-01T12:00:00Z",
                    "updated_at": "2026-10-01T12:00:00Z",
                    "name_servers": [
                        "ns-1234.awsdns-26.org.",
                        "ns-567.awsdns-06.net.",
                        "ns-1789.awsdns-31.co.uk.",
                        "ns-89.awsdns-11.com.",
                    ],
                    "vpc": None,
                }
            ]
        },
    )

    updated_at: datetime
    name_servers: list[str] = Field(description="The four servers Route 53 assigned.")
    vpc: Vpc | None


class HostedZoneUpdate(BaseModel):
    """Route 53 only lets a zone's comment change after it is created."""

    comment: str | None = Field(max_length=COMMENT_MAX_LENGTH)
    tags: list[HostedZoneTag] | None = Field(default=None, max_length=50)

    @field_validator("comment")
    @classmethod
    def _blank_comment_is_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("tags")
    @classmethod
    def _tags_are_unique(cls, value: list[HostedZoneTag] | None) -> list[HostedZoneTag] | None:
        return _unique_tags(value) if value is not None else None


HostedZoneSort = Literal[
    "name", "-name", "type", "-type", "record_count", "-record_count", "created_at", "-created_at"
]


class HostedZoneListParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q: str | None = Field(
        default=None,
        max_length=255,
        description="Case-insensitive text to find in the name, ID or comment.",
    )
    tag_key: str | None = Field(default=None, min_length=1, max_length=TAG_KEY_MAX_LENGTH)
    tag_value: str | None = Field(default=None, max_length=TAG_VALUE_MAX_LENGTH)
    sort: HostedZoneSort = Field(default="name", description="Prefix with - for descending.")
    page: int = Field(default=1, ge=1)
    # Route 53's ListHostedZones also returns up to 100 by default.
    page_size: int = Field(default=100, ge=1, le=100)


class HostedZoneList(BaseModel):
    items: list[HostedZoneOut]
    total: int = Field(description="Number of hosted zones matching the request.")
    page: int
    page_size: int
