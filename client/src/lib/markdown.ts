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
  let listIndentLevel = 0;

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

  const getIndentLevel = (line: string) => {
    return line.match(/^\s*/)?.[0].length || 0;
  };

  const isListContent = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // Empty lines within a list

    const indent = getIndentLevel(line);
    // Consider it list content if:
    // 1. It's a new list item
    // 2. It's indented more than the list start
    // 3. It's an empty line (already handled above)
    return isListMarker(line) || indent > listIndentLevel;
  };

  const lookAheadForList = (currentIndex: number) => {
    // Look ahead a few lines to see if we're still in a list context
    for (let i = currentIndex + 1; i < Math.min(lines.length, currentIndex + 3); i++) {
      const line = lines[i];
      if (line.trim() && (isListMarker(line) || getIndentLevel(line) > listIndentLevel)) {
        return true;
      }
    }
    return false;
  };

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
      if (isListMarker(line) && !inList) {
        // Start of a new list
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
        }
        inList = true;
        listIndentLevel = getIndentLevel(line);
        currentChunk.push(line);
        continue;
      }

      if (inList) {
        if (!trimmed && lookAheadForList(i)) {
          // Empty line with more list content ahead
          currentChunk.push(line);
          continue;
        }

        if (isListContent(line)) {
          // Continue the list
          currentChunk.push(line);
          continue;
        } else {
          // List has ended
          addChunk(currentChunk);
          currentChunk = [line];
          inList = false;
          continue;
        }
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