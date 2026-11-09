import pytest
import io
import fitz
import docx
from app.pipeline.parsers.pdf_parser import parse_pdf_bytes
from app.pipeline.parsers.docx_parser import parse_docx_bytes
from app.pipeline.parsers.txt_parser import parse_txt_bytes
from app.pipeline.chunker.text_chunker import chunk_document
from app.pipeline.embedder.embedder import get_embedder, generate_deterministic_vector


def test_txt_parser_and_chunker():
  sample_text = (
      "Title: Project Architecture Spec\n"
      "Section 1: The database is MongoDB Atlas.\n"
      "Section 2: The service runs on port 5000.\n"
      "Section 3: Authorization is mediated through accessService."
  )
  parsed = parse_txt_bytes(data=sample_text.encode("utf-8"), original_name="test.txt")
  assert len(parsed.locators) > 0
  assert "MongoDB Atlas" in parsed.raw_text

  chunks = chunk_document(parsed, source_id="src-1", project_id="proj-1")
  assert len(chunks) >= 1
  first_chunk = chunks[0]
  assert first_chunk["sourceId"] == "src-1"
  assert first_chunk["projectId"] == "proj-1"
  assert first_chunk["order"] == 1
  assert "chunkId" in first_chunk
  assert "textHash" in first_chunk
  assert len(first_chunk["textHash"]) == 64  # sha256


def test_pdf_parser():
  # Create a real in-memory PDF using PyMuPDF
  doc = fitz.open()
  page = doc.new_page()
  page.insert_text(
      (50, 72), "Handover Document: All backend routes require JWT auth."
  )
  pdf_bytes = doc.tobytes()
  doc.close()

  parsed = parse_pdf_bytes(pdf_bytes, original_name="sample.pdf")
  assert parsed.metadata["format"] == "pdf"
  assert parsed.metadata["totalPages"] == 1
  assert len(parsed.locators) == 1
  assert parsed.locators[0].page == 1
  assert "JWT auth" in parsed.raw_text


def test_docx_parser():
  # Create a real in-memory DOCX using python-docx
  doc = docx.Document()
  doc.add_heading("Architecture Meeting", level=1)
  doc.add_paragraph("Decision: Use TypeScript strict mode everywhere.")
  stream = io.BytesIO()
  doc.save(stream)
  docx_bytes = stream.getvalue()

  parsed = parse_docx_bytes(docx_bytes, original_name="notes.docx")
  assert parsed.metadata["format"] == "docx"
  assert len(parsed.locators) >= 1
  assert parsed.locators[0].paragraph == 1
  assert "TypeScript strict mode" in parsed.raw_text


@pytest.mark.anyio
async def test_embedder_dimension():
  embedder = get_embedder()
  vectors = await embedder.embed_texts(["Hello world knowledge handover"])
  assert len(vectors) == 1
  assert len(vectors[0]) == 1536  # Standard OpenAI embedding dimension


def test_deterministic_vector():
  v1 = generate_deterministic_vector("Hello world")
  v2 = generate_deterministic_vector("Hello world")
  v3 = generate_deterministic_vector("Different text")

  assert len(v1) == 1536
  assert v1 == v2  # Same text generates identical vector
  assert v1 != v3  # Different text generates different vector

