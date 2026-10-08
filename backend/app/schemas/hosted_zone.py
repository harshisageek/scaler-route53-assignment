from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.models.hosted_zone import COMMENT_MAX_LENGTH
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


class HostedZoneList(BaseModel):
    items: list[HostedZoneOut]
    total: int = Field(description="Number of hosted zones matching the request.")
