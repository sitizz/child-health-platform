import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Child(Base):
    __tablename__ = "children"
    __table_args__ = (UniqueConstraint("caregiver_id", "id", name="uq_caregiver_child"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    caregiver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("caregivers.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    age: Mapped[int] = mapped_column(Integer)
    sex: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    conditions: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    allergies: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    symptoms: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    exposures: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    caregiver = relationship("Caregiver", back_populates="children")
    assessments = relationship(
        "RiskAssessment", back_populates="child", cascade="all, delete-orphan"
    )
