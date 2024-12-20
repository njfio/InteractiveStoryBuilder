/**
 * Markdown parsing and chunking implementation
 * Rules:
 * 1. Chapter headers (H1) start new sections and are their own chunks
 * 2. Lists and previews are kept together as single chunks
 * 3. Paragraphs that form complete thoughts stay together
 * 4. Empty lines between unrelated paragraphs signal chunk boundaries
 * 5. Code blocks and special sections are preserved as units
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
  let currentChunk: string[] = [];
  let inPreview = false;
  let inCodeBlock = false;
  let inList = false;
  let listIndent = 0;

  const addChunk = (content: string[], force = false) => {
    const text = content.join('\n').trim();
    if (!text) return;

    // Count non-empty lines
    const nonEmptyLines = content.filter(line => line.trim()).length;
    if (force || inPreview || inList || nonEmptyLines >= (settings.minLines || 2)) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
  };

  const isListMarker = (line: string) => {
    const trimmed = line.trim();
    return /^[-*+]|\d+\./.test(trimmed);
  };

  const getIndentLevel = (line: string) => {
    return line.match(/^\s*/)?.[0].length || 0;
  };

  const isPartOfList = (line: string, baseIndent: number) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // Empty lines in a list context
    const indent = getIndentLevel(line);
    return indent > baseIndent || isListMarker(line);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Handle separators (---)
    if (/^-{3,}$/.test(trimmed)) {
      if (currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
      }
      addChunk([line], true);
      continue;
    }

    // Handle chapter headers (H1)
    if (trimmed.startsWith('# ')) {
      if (currentChunk.length > 0) {
        addChunk(currentChunk, inPreview);
        currentChunk = [];
      }
      currentH1 = trimmed.substring(2);
      addChunk([line], true);
      continue;
    }

    // Handle other headers
    if (trimmed.startsWith('#')) {
      if (currentChunk.length > 0) {
        addChunk(currentChunk, inPreview);
        currentChunk = [];
      }
      addChunk([line], true);
      continue;
    }

    // Handle preview sections
    if (trimmed === 'Preview of What\'s to Come:') {
      if (currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
      }
      inPreview = true;
      currentChunk.push(line);
      continue;
    }

    // Handle code blocks
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
        }
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
        currentChunk.push(line);
        addChunk(currentChunk, true);
        currentChunk = [];
        continue;
      }
    }

    if (inCodeBlock) {
      currentChunk.push(line);
      continue;
    }

    // Handle lists
    if (settings.preserveLists) {
      if (isListMarker(line) && !inList) {
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
        }
        inList = true;
        listIndent = getIndentLevel(line);
        currentChunk.push(line);
      } else if (inList) {
        if (isPartOfList(line, listIndent)) {
          currentChunk.push(line);
        } else {
          addChunk(currentChunk, true);
          currentChunk = [line];
          inList = false;
        }
      } else {
        // Handle regular paragraphs
        if (!trimmed) {
          // Look ahead to see if this is a paragraph break or section break
          const nextNonEmpty = lines.slice(i + 1).find(l => l.trim());
          if (!nextNonEmpty || 
              nextNonEmpty.startsWith('#') || 
              isListMarker(nextNonEmpty) ||
              nextNonEmpty === 'Preview of What\'s to Come:') {
            if (currentChunk.length > 0) {
              addChunk(currentChunk);
              currentChunk = [];
            }
          } else {
            currentChunk.push(line);
          }
        } else {
          currentChunk.push(line);
        }
      }
    } else {
      // When not preserving lists, treat everything as regular content
      if (!trimmed && currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
      } else if (trimmed) {
        currentChunk.push(line);
      }
    }
  }

  // Handle any remaining content
  if (currentChunk.length > 0) {
    addChunk(currentChunk, inPreview || inList);
  }

  return chunks;
};