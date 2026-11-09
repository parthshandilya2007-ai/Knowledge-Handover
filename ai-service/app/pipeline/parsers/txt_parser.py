from app.pipeline.parsers.base import ParsedDocument, DocumentLocator


def parse_txt_bytes(
    data: bytes, original_name: str = "", text_content: str = ""
) -> ParsedDocument:
  """
  Extracts text and line-range locators from plain text files or meeting notes.
  """
  if not text_content and data:
    try:
      text_content = data.decode("utf-8")
    except UnicodeDecodeError:
      text_content = data.decode("latin-1")

  lines = text_content.splitlines()
  locators = []

  # Group lines into blocks of ~10 lines for locators
  block_size = 10
  for i in range(0, len(lines), block_size):
    block_lines = lines[i : i + block_size]
    block_text = "\n".join(block_lines).strip()
    if block_text:
      locators.append(
          DocumentLocator(
              lineStart=i + 1,
              lineEnd=i + len(block_lines),
              text=block_text,
              itemType="text_lines",
          )
      )

  if not locators and text_content.strip():
    locators.append(
        DocumentLocator(
            lineStart=1,
            lineEnd=max(1, len(lines)),
            text=text_content.strip(),
            itemType="text_block",
        )
    )

  return ParsedDocument(
      raw_text=text_content,
      locators=locators,
      metadata={
          "format": "txt",
          "totalLines": len(lines),
          "originalName": original_name,
      },
  )

