"""Write the API's OpenAPI schema to a file, for generating the frontend's types.

Usage: uv run python -m scripts.export_openapi <output.json>
"""

import json
import sys
from pathlib import Path

from app.main import create_app


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: python -m scripts.export_openapi <output.json>")
    schema = create_app().openapi()
    Path(sys.argv[1]).write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
