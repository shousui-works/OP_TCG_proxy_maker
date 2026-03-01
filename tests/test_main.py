"""Tests for main module"""

from main import app


def test_app_import():
    """Test that the FastAPI app can be imported from main"""
    from fastapi import FastAPI

    assert isinstance(app, FastAPI)
