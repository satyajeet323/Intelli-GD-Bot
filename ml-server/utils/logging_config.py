"""
utils/logging_config.py — Structured logging for the ML service.

Intentionally avoids importing from ml_server.config to prevent bootstrap
ordering issues when modules are imported before the package alias is registered.
"""

import logging
import os
import sys

# Resolve log directory relative to this file — no cross-package import needed
_HERE     = os.path.dirname(os.path.abspath(__file__))
_ROOT     = os.path.dirname(_HERE)   # ml-server/
_LOGS_DIR = os.getenv("LOGS_DIR", os.path.join(_ROOT, "logs"))
os.makedirs(_LOGS_DIR, exist_ok=True)

_SERVICE_NAME = os.getenv("SERVICE_NAME", "intellibot-ml")


def get_logger(name: str = _SERVICE_NAME) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # already configured

    logger.setLevel(logging.INFO)

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    fh = logging.FileHandler(os.path.join(_LOGS_DIR, "ml-server.log"), encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    return logger
