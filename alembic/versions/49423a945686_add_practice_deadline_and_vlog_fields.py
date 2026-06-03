"""add_practice_deadline_and_vlog_fields

Revision ID: 49423a945686
Revises: 06f27e42cbfb
Create Date: 2026-06-03 18:42:04.330040

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '49423a945686'
down_revision: Union[str, Sequence[str], None] = '06f27e42cbfb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('practice_deadline', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('merged_vlog_url', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('merged_vlog_status', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('merged_vlog_status')
        batch_op.drop_column('merged_vlog_url')
        batch_op.drop_column('practice_deadline')
