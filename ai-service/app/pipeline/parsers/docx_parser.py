import io
import docx
from app.pipeline.parsers.base import ParsedDocument, DocumentLocator


def parse_docx_bytes(data: bytes, original_name: str = "") -> ParsedDocument:
  """
  Extracts text and paragraph-level locators from a DOCX binary stream.
  """
  file_stream = io.BytesIO(data)
  doc = docx.Document(file_stream)

  locators = []
  full_text_parts = []

  p_num = 1
  for p in doc.paragraphs:
    text = p.text.strip()
    if text:
      locators.append(
          DocumentLocator(
              paragraph=p_num, text=text, itemType="docx_paragraph"
          )
      )
      full_text_parts.append(text)
      p_num += 1

  # Also inspect tables if present
  for table in doc.tables:
    for row in table.rows:
      row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
      if row_texts:
        row_str = " | ".join(row_texts)
        locators.append(
            DocumentLocator(
                paragraph=p_num, text=row_str, itemType="docx_table_row"
            )
        )
        full_text_parts.append(row_str)
        p_num += 1

  full_text = "\n\n".join(full_text_parts)
  return ParsedDocument(
      raw_text=full_text,
      locators=locators,
      metadata={
          "format": "docx",
          "totalParagraphs": p_num - 1,
          "originalName": original_name,
      },
  )

