"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-07-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "caregivers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_caregivers_email", "caregivers", ["email"], unique=True)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("caregivers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_refresh_tokens_caregiver_id", "refresh_tokens", ["caregiver_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)

    op.create_table(
        "children",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("caregivers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=True),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("sex", sa.String(32), nullable=True),
        sa.Column("is_selected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("conditions", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("allergies", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("symptoms", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("exposures", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("caregiver_id", "id", name="uq_caregiver_child"),
    )
    op.create_index("ix_children_caregiver_id", "children", ["caregiver_id"])

    op.create_table(
        "consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("caregivers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("checkboxes", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("notifications_opt_in", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "accepted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_consents_caregiver_id", "consents", ["caregiver_id"])
    op.create_index("ix_consents_version", "consents", ["version"])

    op.create_table(
        "disclaimer_acks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("caregivers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column(
            "acknowledged_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("caregiver_id", "version", name="uq_disclaimer_caregiver_version"),
    )
    op.create_index("ix_disclaimer_acks_caregiver_id", "disclaimer_acks", ["caregiver_id"])

    op.create_table(
        "device_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("caregivers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expo_push_token", sa.String(255), nullable=False),
        sa.Column("platform", sa.String(32), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_device_tokens_caregiver_id", "device_tokens", ["caregiver_id"])
    op.create_index("ix_device_tokens_expo_push_token", "device_tokens", ["expo_push_token"], unique=True)

    op.create_table(
        "risk_assessments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("priority", sa.String(32), nullable=False),
        sa.Column("summary", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_risk_assessments_child_id", "risk_assessments", ["child_id"])
    op.create_index("ix_risk_assessments_priority", "risk_assessments", ["priority"])
    op.create_index("ix_risk_assessments_created_at", "risk_assessments", ["created_at"])

    op.create_table(
        "notification_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("caregivers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("children.id", ondelete="SET NULL"), nullable=True),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="sent"),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_notification_log_caregiver_id", "notification_log", ["caregiver_id"])

    op.create_table(
        "notification_state",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("caregiver_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("caregivers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("children.id", ondelete="CASCADE"), nullable=False),
        sa.Column("last_priority", sa.String(32), nullable=True),
        sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("caregiver_id", "child_id", name="uq_notification_state_child"),
    )
    op.create_index("ix_notification_state_caregiver_id", "notification_state", ["caregiver_id"])
    op.create_index("ix_notification_state_child_id", "notification_state", ["child_id"])


def downgrade() -> None:
    op.drop_table("notification_state")
    op.drop_table("notification_log")
    op.drop_table("risk_assessments")
    op.drop_table("device_tokens")
    op.drop_table("disclaimer_acks")
    op.drop_table("consents")
    op.drop_table("children")
    op.drop_table("refresh_tokens")
    op.drop_table("caregivers")
