from sqlalchemy import Column, String, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class AuditLog(Base):
    """
    Audit log for tracking all sensitive operations
    Required for SOC 2 compliance
    """
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Who performed the action
    user_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    user_email = Column(String, nullable=True)
    
    # What action was performed
    action = Column(String, nullable=False, index=True)  # e.g., "user.login", "rfq.create", "data.access"
    resource_type = Column(String, nullable=True, index=True)  # e.g., "user", "rfq", "company"
    resource_id = Column(String, nullable=True, index=True)
    
    # Additional context
    details = Column(JSONB, nullable=True, default=dict)
    
    # Request metadata
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    request_path = Column(String, nullable=True)
    request_method = Column(String, nullable=True)
    
    # Result
    status = Column(String, nullable=False)  # "success", "failure", "error"
    status_code = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamp
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    def __repr__(self):
        return f"<AuditLog {self.action} by {self.user_email} at {self.timestamp}>"
