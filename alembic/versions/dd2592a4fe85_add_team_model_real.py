"""Add Team model real

Revision ID: dd2592a4fe85
Revises: 1af709ba7780
Create Date: 2026-05-30 00:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "dd2592a4fe85"
down_revision = "1af709ba7780"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create teams table
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. Create team_members table
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("instrument", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("team_members", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_team_members_team_id"), ["team_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_team_members_user_id"), ["user_id"], unique=False)

    # 3. Add team_id to projects
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.add_column(sa.Column("team_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_projects_team_id_teams", "teams", ["team_id"], ["id"], ondelete="CASCADE"
        )

    # 4. Add team_id to collaboration_posts and make project_id nullable
    with op.batch_alter_table("collaboration_posts", schema=None) as batch_op:
        batch_op.add_column(sa.Column("team_id", sa.Integer(), nullable=True))
        batch_op.alter_column("project_id", existing_type=sa.String(), nullable=True)
        batch_op.create_foreign_key(
            "fk_collaboration_posts_team_id_teams", "teams", ["team_id"], ["id"], ondelete="CASCADE"
        )
        batch_op.create_index(
            batch_op.f("ix_collaboration_posts_team_id"), ["team_id"], unique=False
        )

    # 5. Add team_id to practice_logs and make project_id nullable
    with op.batch_alter_table("practice_logs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("team_id", sa.Integer(), nullable=True))
        batch_op.alter_column("project_id", existing_type=sa.String(), nullable=True)
        batch_op.create_foreign_key(
            "fk_practice_logs_team_id_teams", "teams", ["team_id"], ["id"], ondelete="CASCADE"
        )
        batch_op.create_index(batch_op.f("ix_practice_logs_team_id"), ["team_id"], unique=False)


def downgrade() -> None:
    # 5. Drop team_id from practice_logs, revert project_id nullable
    with op.batch_alter_table("practice_logs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_practice_logs_team_id"))
        batch_op.drop_constraint("fk_practice_logs_team_id_teams", type_="foreignkey")
        batch_op.drop_column("team_id")
        batch_op.alter_column("project_id", existing_type=sa.String(), nullable=False)

    # 4. Drop team_id from collaboration_posts, revert project_id nullable
    with op.batch_alter_table("collaboration_posts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_collaboration_posts_team_id"))
        batch_op.drop_constraint("fk_collaboration_posts_team_id_teams", type_="foreignkey")
        batch_op.drop_column("team_id")
        batch_op.alter_column("project_id", existing_type=sa.String(), nullable=False)

    # 3. Drop team_id from projects
    with op.batch_alter_table("projects", schema=None) as batch_op:
        batch_op.drop_constraint("fk_projects_team_id_teams", type_="foreignkey")
        batch_op.drop_column("team_id")

    # 2. Drop team_members table
    with op.batch_alter_table("team_members", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_team_members_user_id"))
        batch_op.drop_index(batch_op.f("ix_team_members_team_id"))
    op.drop_table("team_members")

    # 1. Drop teams table
    op.drop_table("teams")
