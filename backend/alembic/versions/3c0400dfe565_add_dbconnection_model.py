"""Legacy migration placeholder.

This revision used to add DbConnection incrementally in the old chain.
The schema is now fully defined in 001_initial baseline.

Revision ID: 3c0400dfe565
Revises: 001_initial
Create Date: 2026-01-15 13:06:52.317035
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '3c0400dfe565'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Intentionally left blank.
    pass


def downgrade() -> None:
    # Intentionally left blank.
    pass
