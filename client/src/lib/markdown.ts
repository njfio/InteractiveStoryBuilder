/**
 * Simple markdown chunking implementation
 * Rules:
 * 1. Each chapter/section header is its own chunk
 * 2. Each paragraph is its own chunk
 * 3. Lists are kept together as one chunk (all consecutive list items + their indented lines)
 * 4. Preview sections are kept together (no chunk boundaries until next header)
 */

interface ChunkData {
  headingH1?: string;
  text: string;
  order: number;
}

interface ChunkSettings {
  preserveLists?: boolean;
}

export const parseMarkdown = async (
  markdown: string,
  settings: ChunkSettings = { preserveLists: true }
): Promise<ChunkData[]> => {
  const chunks: ChunkData[] = [];
  let chunkOrder = 0;

  let currentH1: string | undefined;
  let currentChunk: string[] = [];
  let inPreviewSection = false;
  let inList = false;

  const lines = markdown.split('\n');

  const addChunk = () => {
    const text = currentChunk.join('\n').trim();
    if (text) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
    currentChunk = [];
  };

  const isHeader = (line: string) => {
    const trimmed = line.trim();
    return trimmed.startsWith('#');
  };

  // Make preview marker detection more flexible
  const isPreviewMarker = (line: string) => {
    const lower = line.trim().toLowerCase();
    // Check if it starts with "preview of what" and contains "to come"
    // This handles different apostrophes/spaces
    return lower.startsWith('preview of what') && lower.includes('to come');
  };

  const isListItem = (line: string) => {
    const trimmed = line.trim();
    return /^([-*+]\s|\d+\.\s)/.test(trimmed);
  };

  const isBlankLine = (line: string) => line.trim() === '';
  const isIndentedLine = (line: string) => line.startsWith(' ') || line.startsWith('\t');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inPreviewSection) {
      // In preview section, ignore all normal rules
      if (isHeader(line)) {
        // Encountering a header ends the preview section
        addChunk(); // flush the preview chunk
        inPreviewSection = false;
        inList = false;

        // Handle the header as usual
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          currentH1 = trimmed.substring(2);
        }
        currentChunk.push(line);
        addChunk();
      } else {
        // Just add everything to the preview section chunk
        currentChunk.push(line);
      }
      continue;
    }

    // Not in preview section
    if (isHeader(line)) {
      if (currentChunk.length > 0) {
        addChunk();
        inList = false;
      }

      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        currentH1 = trimmed.substring(2);
      }
      currentChunk.push(line);
      addChunk();
      continue;
    }

    if (isPreviewMarker(line)) {
      // flush what's ongoing
      if (currentChunk.length > 0) {
        addChunk();
      }
      inPreviewSection = true;
      inList = false;
      currentChunk.push(line);
      continue;
    }

    // Normal logic outside preview section
    if (inList) {
      // Currently in a list
      if (isBlankLine(line)) {
        // Blank line ends the list chunk
        addChunk();
        inList = false;
      } else if (isListItem(line) || isIndentedLine(line)) {
        // Still part of the list chunk
        currentChunk.push(line);
      } else {
        // Non-list, non-blank line: end list chunk, start new paragraph
        addChunk();
        inList = false;
        if (!isBlankLine(line)) {
          currentChunk.push(line);
        }
      }
    } else {
      // Not in list mode
      if (isListItem(line)) {
        // Encountered a list item
        if (currentChunk.length > 0) {
          // we were building a paragraph, flush it
          addChunk();
        }
        inList = true;
        currentChunk.push(line);
      } else if (isBlankLine(line)) {
        // blank line ends the current paragraph
        if (currentChunk.length > 0) {
          addChunk();
        }
      } else {
        // paragraph line
        currentChunk.push(line);
      }
    }
  }

  // End of file: flush what's left
  if (currentChunk.length > 0) {
    addChunk();
  }

  return chunks;
};