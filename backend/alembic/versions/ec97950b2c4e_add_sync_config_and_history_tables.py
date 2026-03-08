"""Legacy migration placeholder.

This revision used to mutate pre-existing tables in the old migration chain.
The schema is now fully defined in 001_initial baseline.

Revision ID: ec97950b2c4e
Revises: 3c0400dfe565
Create Date: 2026-01-24 01:16:31.252605
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'ec97950b2c4e'
down_revision: Union[str, None] = '3c0400dfe565'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Intentionally left blank.
    pass


def downgrade() -> None:
    # Intentionally left blank.
    pass
