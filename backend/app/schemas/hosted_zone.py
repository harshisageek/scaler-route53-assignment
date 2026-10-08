from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HostedZoneOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "Z0812345ABCDEFGHIJKLM",
                    "name": "example.com.",
                    "comment": "Production zone",
                    "private_zone": False,
                    "created_at": "2026-10-01T12:00:00Z",
                }
            ]
        },
    )

    id: str = Field(description="Route 53 style hosted zone ID.")
    name: str = Field(description="Fully qualified domain name, with the trailing dot.")
    comment: str | None
    private_zone: bool
    created_at: datetime


class HostedZoneList(BaseModel):
    items: list[HostedZoneOut]
    total: int = Field(description="Number of hosted zones matching the request.")
