"""
Validation utilities for path traversal and injection prevention
"""

import re

from fastapi import HTTPException

# Pattern for safe names (alphanumeric, underscore, hyphen)
SAFE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")


def validate_safe_name(name: str, field_name: str = "name") -> str:
    """
    Validate name for path traversal and injection prevention.

    Args:
        name: The name to validate
        field_name: Field name for error messages

    Returns:
        The validated name

    Raises:
        ValueError: If validation fails
    """
    if not name or not SAFE_NAME_PATTERN.match(name):
        raise ValueError(
            f"Invalid {field_name}: only alphanumeric, underscore, and hyphen allowed"
        )
    if len(name) > 100:
        raise ValueError(f"{field_name} is too long (max 100 characters)")
    return name


def validate_path_component(name: str, component_type: str = "name") -> None:
    """
    Validate path component for API routes.

    Args:
        name: The path component to validate
        component_type: Component type for error messages

    Raises:
        HTTPException: If validation fails
    """
    if not name or not SAFE_NAME_PATTERN.match(name):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {component_type}: "
            "only alphanumeric, underscore, and hyphen allowed",
        )
