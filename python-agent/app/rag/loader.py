import io

import pandas as pd
from bs4 import BeautifulSoup
from docx import Document as DocxDocument
from pypdf import PdfReader

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".xls", ".csv", ".html", ".htm", ".txt", ".md"}


def load_text(filename: str, content: bytes) -> str:
    """Extracts plain text from an uploaded document, dispatching on extension."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == ".pdf":
        return _load_pdf(content)
    if ext == ".docx":
        return _load_docx(content)
    if ext in (".xlsx", ".xls"):
        return _load_excel(content)
    if ext == ".csv":
        return pd.read_csv(io.BytesIO(content)).to_string(index=False)
    if ext in (".html", ".htm"):
        return _load_html(content)
    # Plain text / markdown / anything else: decode as UTF-8 best-effort.
    return content.decode("utf-8", errors="ignore")


def _load_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _load_docx(content: bytes) -> str:
    doc = DocxDocument(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs)


def _load_excel(content: bytes) -> str:
    sheets = pd.read_excel(io.BytesIO(content), sheet_name=None)
    return "\n\n".join(f"# {name}\n{df.to_string(index=False)}" for name, df in sheets.items())


def _load_html(content: bytes) -> str:
    soup = BeautifulSoup(content, "html.parser")
    return soup.get_text(separator="\n", strip=True)
