from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

class GeneralSettings(BaseModel):
    institution_name: str = Field(default="Gayathri Central School")
    ai_companion_name: str = Field(default="Gayu AI")
    contact_email: EmailStr = Field(default="admin@gayathrischool.com")
    contact_phone: str = Field(default="+919876543210")
    office_address: str = Field(default="Gayathri Campus, Trivandrum, Kerala")

class AISettings(BaseModel):
    current_model: str = Field(default="llama3.2:latest")
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_context: int = Field(default=4096)
    streaming: bool = Field(default=True)
    max_tokens: int = Field(default=2048)
    response_timeout: int = Field(default=30)
    allow_general_knowledge: bool = Field(default=False)

class CategorySchema(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#06b6d4"

class DocumentSchema(BaseModel):
    filename: str
    size: int
    upload_date: str
    status: str = "Ready"  # Uploading, Extracting, Indexing, Ready
    category: str = "Uncategorized"
    pages: int = 1
    characters: int = 0
    chunks: int = 0
    embeddings_count: int = 0
    collection_name: str = "school_kb"
    embedding_model: str = "nomic-embed-text"
    verification_status: str = "Pending"
    search_ready: bool = False
    processing_time_ms: int = 0
    error_message: Optional[str] = None

class KBSettings(BaseModel):
    supported_file_types: List[str] = Field(default=["pdf", "txt", "docx"])
    max_upload_size_mb: int = Field(default=10)
    auto_reindex: bool = Field(default=True)
    chunk_size: int = Field(default=1000)
    chunk_overlap: int = Field(default=200)
    embedding_model: str = Field(default="nomic-embed-text")
    auto_document_processing: bool = Field(default=True)
    categories: List[CategorySchema] = Field(default_factory=list)
    documents: List[DocumentSchema] = Field(default_factory=list)

class SecuritySettings(BaseModel):
    session_timeout_minutes: int = Field(default=30)
    jwt_expiration_hours: int = Field(default=24)
    password_policy: str = Field(default="medium") # simple, medium, strong
    admin_login_attempts: int = Field(default=5)
    account_lock_duration_seconds: int = Field(default=900)
    role_defaults: str = Field(default="standard")

class BrandingSettings(BaseModel):
    school_logo: str = Field(default="shared/logo.png")
    ai_mascot: str = Field(default="shared/mascot.png")
    accent_color: str = Field(default="#06b6d4")
    school_motto: str = Field(default="Innovation through Inclusivity")
    favicon: str = Field(default="shared/favicon.ico")
    welcome_message: str = Field(default="Welcome back. I am {{assistant_name}}. Ask me anything about school policies, admission, innovation lab launches, or timings.")

class CompleteConfiguration(BaseModel):
    general: GeneralSettings = Field(default_factory=GeneralSettings)
    ai: AISettings = Field(default_factory=AISettings)
    kb: KBSettings = Field(default_factory=KBSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    branding: BrandingSettings = Field(default_factory=BrandingSettings)
