"""engagement_events table for user engagement tracking

Revision ID: 003
Revises: 002
Create Date: 2026-08-03

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "engagement_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "caregiver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("caregivers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_engagement_events_caregiver_id",
        "engagement_events",
        ["caregiver_id"],
    )
    op.create_index(
        "ix_engagement_events_event_type",
        "engagement_events",
        ["event_type"],
    )
    op.create_index(
        "ix_engagement_events_created_at",
        "engagement_events",
        ["created_at"],
    )
    op.create_index(
        "ix_engagement_events_caregiver_type_created",
        "engagement_events",
        ["caregiver_id", "event_type", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_engagement_events_caregiver_type_created",
        table_name="engagement_events",
    )
    op.drop_index("ix_engagement_events_created_at", table_name="engagement_events")
    op.drop_index("ix_engagement_events_event_type", table_name="engagement_events")
    op.drop_index("ix_engagement_events_caregiver_id", table_name="engagement_events")
    op.drop_table("engagement_events")
