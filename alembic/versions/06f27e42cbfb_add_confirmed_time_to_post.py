"""add_confirmed_time_to_post

Revision ID: 06f27e42cbfb
Revises: abd4c78bed95
Create Date: 2026-06-02 20:45:45.670384

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "06f27e42cbfb"
down_revision: Union[str, Sequence[str], None] = "abd4c78bed95"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("collaboration_posts", sa.Column("confirmed_time", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("collaboration_posts", "confirmed_time")
