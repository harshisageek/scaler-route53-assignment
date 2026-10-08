from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


class _Credentials(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower_case(cls, value: str) -> str:
        return value.lower()


class SignUpRequest(_Credentials):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"email": "you@example.com", "password": "a long password"}]
        }
    )

    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)


class SignInRequest(_Credentials):
    # No minimum: a too-short password is simply wrong, not malformed.
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: str
    account_id: str = Field(description="Mocked 12-digit AWS account ID.")
    is_demo: bool
    created_at: datetime
