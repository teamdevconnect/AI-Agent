from pydantic import BaseModel


class ChatRequest(BaseModel):
    user_id: str
    conversation_id: str
    message: str
    agent_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    tools_used: list[str] = []


class IngestResponse(BaseModel):
    document_id: str
    chunks: int
    status: str


class RoleKpi(BaseModel):
    name: str
    description: str


class RoleGenerateResponse(BaseModel):
    documentId: str
    chunks: int
    sourceDocumentName: str
    name: str
    department: str
    description: str
    responsibilities: list[str]
    dailyTasks: list[str]
    weeklyTasks: list[str]
    kpis: list[RoleKpi]
    systemPrompt: str


class SourceRef(BaseModel):
    documentId: str
