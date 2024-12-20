/**
 * Markdown parsing and chunking implementation
 * Rules:
 * 1. Headers are always their own chunks
 * 2. Lists (including nested) stay together as one chunk
 * 3. Paragraphs separated by blank lines form chunks
 * 4. Code blocks (including fences) are their own chunks
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

  // Split content into lines for processing
  const lines = markdown.split('\n');
  let currentLines: string[] = [];
  let inCodeBlock = false;
  let inList = false;
  let listIndentLevel = 0;

  const createChunk = (content: string[], force = false) => {
    const text = content.join('\n').trim();
    if (!text) return;

    // Non-empty lines determine if chunk meets minimum size
    const nonEmptyLines = content.filter(line => line.trim()).length;

    // Create chunk if:
    // 1. Force is true (headers)
    // 2. Content is a list
    // 3. Meets minimum line requirement
    if (force || inList || nonEmptyLines >= (settings.minLines || 2)) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
  };

  const isListLine = (line: string) => {
    const trimmed = line.trim();
    return /^[-*+]|\d+\./.test(trimmed);
  };

  const getIndentLevel = (line: string) => {
    return line.match(/^\s*/)?.[0].length ?? 0;
  };

  const isListContinuation = (line: string, currentIndent: number) => {
    if (!line.trim()) return true; // Empty lines in list context
    const indent = getIndentLevel(line);
    return indent > currentIndent || isListLine(line);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const nextLine = lines[i + 1];

    // Handle headers
    if (trimmedLine.startsWith('#')) {
      if (currentLines.length > 0) {
        createChunk(currentLines, inList);
        currentLines = [];
      }

      // Update current H1 if this is one
      if (trimmedLine.startsWith('# ')) {
        currentH1 = trimmedLine.substring(2);
      }

      createChunk([line], true);
      inList = false;
      continue;
    }

    // Handle code blocks
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        if (currentLines.length > 0) {
          createChunk(currentLines, inList);
          currentLines = [];
        }
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
        createChunk(currentLines.concat(line), true);
        currentLines = [];
        continue;
      }
    }

    if (inCodeBlock) {
      currentLines.push(line);
      continue;
    }

    // Handle lists
    if (settings.preserveLists) {
      if (isListLine(line) && !inList) {
        // Start of new list
        if (currentLines.length > 0) {
          createChunk(currentLines);
          currentLines = [];
        }
        inList = true;
        listIndentLevel = getIndentLevel(line);
        currentLines.push(line);
      } else if (inList) {
        // Continue list if indented or another list item
        if (isListContinuation(line, listIndentLevel)) {
          currentLines.push(line);
        } else {
          // List ended, create chunk and start new content
          createChunk(currentLines, true);
          currentLines = [line];
          inList = false;
        }
      } else {
        // Regular paragraph content
        if (!trimmedLine && currentLines.length > 0) {
          // Empty line after content
          const nextNonEmptyLine = lines.slice(i + 1).find(l => l.trim());
          // Only create chunk if next non-empty line starts new content
          if (!nextNonEmptyLine || 
              nextNonEmptyLine.startsWith('#') || 
              isListLine(nextNonEmptyLine)) {
            createChunk(currentLines);
            currentLines = [];
          } else {
            currentLines.push(line);
          }
        } else if (trimmedLine) {
          currentLines.push(line);
        }
      }
    } else {
      // When not preserving lists, handle all content as paragraphs
      if (!trimmedLine && currentLines.length > 0) {
        createChunk(currentLines);
        currentLines = [];
      } else if (trimmedLine) {
        currentLines.push(line);
      }
    }
  }

  // Handle any remaining content
  if (currentLines.length > 0) {
    createChunk(currentLines, inList);
  }

  return chunks;
};