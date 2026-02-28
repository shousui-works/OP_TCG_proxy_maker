"""
Tests for validation utilities
"""

import pytest

from backend.utils.validators import SAFE_NAME_PATTERN, validate_safe_name


class TestSafeNamePattern:
    """Tests for SAFE_NAME_PATTERN regex"""

    def test_valid_alphanumeric(self):
        assert SAFE_NAME_PATTERN.match("abc123")

    def test_valid_underscore(self):
        assert SAFE_NAME_PATTERN.match("deck_name")

    def test_valid_hyphen(self):
        assert SAFE_NAME_PATTERN.match("deck-name")

    def test_valid_mixed(self):
        assert SAFE_NAME_PATTERN.match("My_Deck-01")

    def test_invalid_spaces(self):
        assert not SAFE_NAME_PATTERN.match("deck name")

    def test_invalid_special_chars(self):
        assert not SAFE_NAME_PATTERN.match("deck@name")
        assert not SAFE_NAME_PATTERN.match("deck.name")
        assert not SAFE_NAME_PATTERN.match("deck/name")

    def test_invalid_path_traversal(self):
        assert not SAFE_NAME_PATTERN.match("../etc/passwd")
        assert not SAFE_NAME_PATTERN.match("..\\windows")


class TestValidateSafeName:
    """Tests for validate_safe_name function"""

    def test_valid_name(self):
        result = validate_safe_name("my_deck-01")
        assert result == "my_deck-01"

    def test_empty_name_raises(self):
        with pytest.raises(ValueError, match="Invalid"):
            validate_safe_name("")

    def test_invalid_chars_raises(self):
        with pytest.raises(ValueError, match="Invalid"):
            validate_safe_name("deck/name")

    def test_too_long_raises(self):
        long_name = "a" * 101
        with pytest.raises(ValueError, match="too long"):
            validate_safe_name(long_name)

    def test_max_length_allowed(self):
        max_name = "a" * 100
        result = validate_safe_name(max_name)
        assert result == max_name

    def test_custom_field_name(self):
        with pytest.raises(ValueError, match="branch name"):
            validate_safe_name("invalid@name", "branch name")
