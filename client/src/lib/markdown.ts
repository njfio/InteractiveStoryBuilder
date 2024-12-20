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
  let inList = false;

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

  const isListMarker = (line: string) => {
    return /^[-*+]|\d+\./.test(line.trim());
  };

  const isBlankLine = (line: string) => line.trim() === '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle headers (including chapter headers)
    if (trimmed.startsWith('#')) {
      // Save any existing chunk
      if (currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
        inList = false;
      }

      // Update current H1 if this is a chapter header
      if (trimmed.startsWith('# ')) {
        currentH1 = trimmed.substring(2);
      }

      // Create header chunk
      addChunk([line]);
      continue;
    }

    // Handle lists
    if (settings.preserveLists) {
      // Start of a new list
      if (isListMarker(line) && !inList) {
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
        }
        inList = true;
        currentChunk.push(line);
        continue;
      }

      // Continue collecting list content (including blank lines)
      if (inList) {
        // End list only if we hit a new header or a non-empty non-list line
        if (!isBlankLine(line) && !isListMarker(line) && !line.startsWith(' ')) {
          addChunk(currentChunk);
          currentChunk = [line];
          inList = false;
        } else {
          currentChunk.push(line);
        }
        continue;
      }
    }

    // Handle regular content
    if (!trimmed && currentChunk.length > 0) {
      // Empty line after content - create chunk
      addChunk(currentChunk);
      currentChunk = [];
    } else if (trimmed) {
      currentChunk.push(line);
    }
  }

  // Add any remaining content
  if (currentChunk.length > 0) {
    addChunk(currentChunk);
  }

  return chunks;
};