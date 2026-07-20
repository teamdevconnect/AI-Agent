import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    jwt_secret: str = os.environ["JWT_SECRET"]

    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

    mongo_uri: str = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    qdrant_url: str = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_collection: str = os.environ.get("QDRANT_COLLECTION", "documents")
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    embedding_model: str = os.environ.get(
        "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )

    rag_sync_interval_minutes: int = int(os.environ.get("RAG_SYNC_INTERVAL_MINUTES", "20"))
    rag_sync_max_pages: int = int(os.environ.get("RAG_SYNC_MAX_PAGES", "40"))

    crm_base_url: str = os.environ.get("CRM_BASE_URL", "")
    crm_api_key: str = os.environ.get("CRM_API_KEY", "")

    ms_graph_client_id: str = os.environ.get("MS_GRAPH_CLIENT_ID", "")
    ms_graph_client_secret: str = os.environ.get("MS_GRAPH_CLIENT_SECRET", "")

    whatsapp_phone_number_id: str = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    whatsapp_access_token: str = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")

    smtp_host: str = os.environ.get("SMTP_HOST", "")
    smtp_port: int = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user: str = os.environ.get("SMTP_USER", "")
    smtp_password: str = os.environ.get("SMTP_PASSWORD", "")

    search_api_key: str = os.environ.get("SEARCH_API_KEY", "")


settings = Settings()
