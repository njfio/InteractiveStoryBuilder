/**
 * Simple markdown chunking implementation
 * Rules:
 * 1. Each chapter/section header is its own chunk
 * 2. Each paragraph is its own chunk
 * 3. Lists are kept together as one chunk
 * 4. Preview sections are kept together
 */

interface ChunkData {
  headingH1?: string;
  text: string;
  order: number;
}

interface ChunkSettings {
  preserveLists?: boolean;
  minLines?: number;
}

export const parseMarkdown = async (
  markdown: string,
  settings: ChunkSettings = { preserveLists: true, minLines: 2 }
): Promise<ChunkData[]> => {
  const chunks: ChunkData[] = [];
  let currentH1: string | undefined;
  let chunkOrder = 0;
  let currentChunk: string[] = [];
  let inPreviewSection = false;

  const lines = markdown.split('\n');

  const addChunk = (lines: string[]) => {
    const text = lines.join('\n').trim();
    if (!text) return;

    chunks.push({
      headingH1: currentH1,
      text,
      order: chunkOrder++
    });
  };

  const isHeader = (line: string) => line.trim().startsWith('#');
  const isPreviewMarker = (line: string) => line.trim() === 'Preview of What\'s to Come:';
  const isListItem = (line: string) => /^[\s]*[-*+]|\d+\./.test(line.trim());
  const isBlankLine = (line: string) => line.trim() === '';
  const isIndentedContent = (line: string) => line.startsWith(' ') && line.trim().length > 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle preview section start
    if (isPreviewMarker(line)) {
      if (currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
      }
      inPreviewSection = true;
      currentChunk.push(line);
      continue;
    }

    // Handle headers
    if (isHeader(line)) {
      if (currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
        inPreviewSection = false;
      }

      if (line.trim().startsWith('# ')) {
        currentH1 = line.trim().substring(2);
      }

      addChunk([line]);
      continue;
    }

    // Handle content based on context
    if (inPreviewSection) {
      // In preview section, keep collecting until we hit a header
      currentChunk.push(line);
    } else if (isListItem(line)) {
      // Start of a list - collect all list items and their content together
      if (currentChunk.length > 0 && !isListItem(currentChunk[currentChunk.length - 1])) {
        // If we were collecting non-list content before, add it as a chunk
        addChunk(currentChunk);
        currentChunk = [];
      }
      currentChunk.push(line);
    } else if (currentChunk.length > 0 && isListItem(currentChunk[currentChunk.length - 1])) {
      // If last line was a list item, this line is either:
      // 1. A blank line within the list
      // 2. Indented content belonging to the list
      // 3. The start of new content (non-blank, non-indented)
      if (isBlankLine(line) || isIndentedContent(line)) {
        currentChunk.push(line);
      } else {
        // Non-blank, non-indented line after list - end the list chunk
        addChunk(currentChunk);
        currentChunk = [line];
      }
    } else {
      // Regular paragraph content
      if (isBlankLine(line) && currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
      } else if (trimmed) {
        currentChunk.push(line);
      }
    }
  }

  // Add any remaining content
  if (currentChunk.length > 0) {
    addChunk(currentChunk);
  }

  return chunks;
};