"""add_youtube_url_to_post_options

Revision ID: abd4c78bed95
Revises: dd2592a4fe85
Create Date: 2026-05-30 14:58:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "abd4c78bed95"
down_revision: Union[str, None] = "dd2592a4fe85"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("post_options", sa.Column("youtube_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("post_options", "youtube_url")
