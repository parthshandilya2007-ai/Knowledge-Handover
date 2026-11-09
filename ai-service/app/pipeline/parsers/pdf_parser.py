import fitz  # PyMuPDF
from app.pipeline.parsers.base import ParsedDocument, DocumentLocator


def parse_pdf_bytes(data: bytes, original_name: str = "") -> ParsedDocument:
  """
  Extracts text and page-level locators from a PDF binary stream.
  """
  doc = fitz.open(stream=data, filetype="pdf")
  locators = []
  full_text_parts = []

  for page_index in range(len(doc)):
    page_num = page_index + 1
    page = doc[page_index]
    page_text = page.get_text("text").strip()

    if page_text:
      locators.append(
          DocumentLocator(page=page_num, text=page_text, itemType="pdf_page")
      )
      full_text_parts.append(page_text)

  full_text = "\n\n".join(full_text_parts)
  return ParsedDocument(
      raw_text=full_text,
      locators=locators,
      metadata={
          "format": "pdf",
          "totalPages": len(doc),
          "originalName": original_name,
      },
  )
