#!/usr/bin/env python3
"""
WSGI entry point for production deployment
"""

import os
from app import app, load_prediction_model

# Load model at startup for production
if __name__ == "__main__":
    try:
        load_prediction_model()
        app.logger.info("Model loaded successfully for production")
    except Exception as e:
        app.logger.error(f"Failed to load model: {e}")
        raise

# For WSGI servers (gunicorn, uwsgi, etc.)
application = app
