import os
import pytest
from alembic.config import Config
from alembic import command


def test_alembic_migrations_lifecycle():
    """
    Tests that Alembic can run upgrade and downgrade cycles cleanly
    against the target database.
    """
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ini_path = os.path.join(backend_dir, "alembic.ini")

    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))

    # 1. Run upgrade to head
    command.upgrade(alembic_cfg, "head")

    # 2. Run downgrade to base
    command.downgrade(alembic_cfg, "base")

    # 3. Upgrade back to head
    command.upgrade(alembic_cfg, "head")
