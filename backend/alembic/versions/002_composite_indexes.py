"""composite indexes for consents and risk_assessments

Revision ID: 002
Revises: 001
Create Date: 2026-07-22

"""

from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent-ish for envs that already got these from an edited 001
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_consents_caregiver_version "
        "ON consents (caregiver_id, version)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_risk_assessments_child_created "
        "ON risk_assessments (child_id, created_at)"
    )


def downgrade() -> None:
    op.drop_index("ix_risk_assessments_child_created", table_name="risk_assessments")
    op.drop_index("ix_consents_caregiver_version", table_name="consents")
