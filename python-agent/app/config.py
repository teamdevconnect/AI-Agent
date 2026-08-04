import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    jwt_secret: str = os.environ["JWT_SECRET"]

    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    # Cheaper/faster model for routing decisions (classify_request, critique_response) —
    # both are one-shot forced-tool-choice judgments, not final-answer generation, so they
    # don't need the full model. Defaults to anthropic_model (no behavior change) until a
    # Haiku-tier model id your API key has access to is set here.
    anthropic_routing_model: str = os.environ.get("ANTHROPIC_ROUTING_MODEL", anthropic_model)

    # Fast path for tool-free general-knowledge/coding/casual requests
    # (see app.agent.groq_client) — empty string disables it, falling back
    # to the Anthropic-only path unchanged.
    groq_api_key: str = os.environ.get("GROQ_API_KEY", "")
    groq_model: str = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    mongo_uri: str = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    # Only used by app.notifications.client to push proactive notifications
    # (see app.workflows.definitions) — every other backend<->agent call goes
    # the other direction (NestJS calls python-agent), this is the one
    # exception, needed because only the backend owns the Socket.IO
    # connection the frontend listens on.
    backend_url: str = os.environ.get("BACKEND_URL", "http://localhost:3000")
    qdrant_url: str = os.environ.get("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key: str = os.environ.get("QDRANT_API_KEY", "")
    qdrant_collection: str = os.environ.get("QDRANT_COLLECTION", "documents")
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    embedding_model: str = os.environ.get(
        "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )

    rag_sync_interval_minutes: int = int(os.environ.get("RAG_SYNC_INTERVAL_MINUTES", "20"))
    rag_sync_max_pages: int = int(os.environ.get("RAG_SYNC_MAX_PAGES", "40"))

    # Mirrors connected external-CRM deals into the native crm_deals
    # collection so Owner/Manager/Consultant dashboards show real numbers
    # (see app.integrations.crm_mongo_sync) — shorter interval than the RAG
    # sync since dashboards poll every 60s and this is what backs their numbers.
    crm_mongo_sync_interval_minutes: int = int(os.environ.get("CRM_MONGO_SYNC_INTERVAL_MINUTES", "10"))

    crm_cache_ttl_seconds: int = int(os.environ.get("CRM_CACHE_TTL_SECONDS", "90"))
    outlook_cache_ttl_seconds: int = int(os.environ.get("OUTLOOK_CACHE_TTL_SECONDS", "45"))

    crm_base_url: str = os.environ.get("CRM_BASE_URL", "")
    crm_api_key: str = os.environ.get("CRM_API_KEY", "")

    ms_graph_client_id: str = os.environ.get("MS_GRAPH_CLIENT_ID", "")
    ms_graph_client_secret: str = os.environ.get("MS_GRAPH_CLIENT_SECRET", "")

    google_client_id: str = os.environ.get("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    whatsapp_phone_number_id: str = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    whatsapp_access_token: str = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")

    smtp_host: str = os.environ.get("SMTP_HOST", "")
    smtp_port: int = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user: str = os.environ.get("SMTP_USER", "")
    smtp_password: str = os.environ.get("SMTP_PASSWORD", "")

    search_api_key: str = os.environ.get("SEARCH_API_KEY", "")


settings = Settings()
