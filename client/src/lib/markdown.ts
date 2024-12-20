import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

interface ChunkData {
  headingH1?: string;
  text: string;
  order: number;
}

interface ChunkSettings {
  preserveLists?: boolean;
  minLines?: number;
  paragraphsPerChunk?: number;
}

export const parseMarkdown = async (
  markdown: string,
  settings: ChunkSettings = { preserveLists: true, minLines: 2, paragraphsPerChunk: 1 }
): Promise<ChunkData[]> => {
  const chunks: ChunkData[] = [];
  let currentH1: string | undefined;
  let chunkOrder = 0;

  // Split content into lines
  const lines = markdown.split('\n');
  let currentChunk: string[] = [];
  let paragraphCount = 0;
  let inCodeBlock = false;
  let inList = false;
  let listIndentLevel = 0;

  const addChunk = (lines: string[], force = false) => {
    const text = lines.join('\n').trim();
    if (!text) return;

    // Only force bypass for H1 headers
    if (force && text.startsWith('# ')) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
      return;
    }

    // All other content must meet minimum line requirement
    const nonEmptyLines = text.split('\n').filter(line => line.trim()).length;
    const minLines = settings.minLines || 2;

    if (nonEmptyLines >= minLines) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
  };

  // Function to check if a line is part of a list
  const isListItem = (line: string) => {
    const trimmed = line.trim();
    return /^[-*+]|\d+\./.test(trimmed);
  };

  // Function to check if a line is a list continuation
  const isListContent = (line: string) => {
    if (!line.trim()) return true; // Empty lines in lists are part of the list
    const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
    return leadingSpaces > listIndentLevel;
  };

  // Function to detect if we're still in a list context
  const isListContext = (startIndex: number): boolean => {
    let i = startIndex;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }
      return isListItem(lines[i]) || isListContent(lines[i]);
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Handle headings
    if (trimmedLine.startsWith('#')) {
      if (currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
        paragraphCount = 0;
      }

      if (trimmedLine.startsWith('# ')) {
        currentH1 = trimmedLine.replace(/^#\s+/, '');
        addChunk([line], true);
      } else {
        addChunk([line], true);
      }
      continue;
    }

    // Handle code blocks
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
          paragraphCount = 0;
        }
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
        currentChunk.push(line);
        addChunk(currentChunk);
        currentChunk = [];
        paragraphCount = 0;
      }
      continue;
    }

    if (inCodeBlock) {
      currentChunk.push(line);
      continue;
    }

    // Handle lists
    if (settings.preserveLists) {
      // Detect start of a list
      if (isListItem(line) && !inList) {
        // If we have content and it's not part of a list, create a chunk
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
          paragraphCount = 0;
        }
        inList = true;
        listIndentLevel = line.match(/^\s*/)?.[0].length || 0;
      }

      if (inList) {
        currentChunk.push(line);
        // Check if list is ending
        if (!isListContext(i + 1)) {
          inList = false;
          // Only create chunk if we have enough content
          if (currentChunk.length > 0) {
            addChunk(currentChunk);
            currentChunk = [];
            paragraphCount = 0;
          }
        }
        continue;
      }
    }

    // Handle regular paragraphs and blank lines
    if (!trimmedLine) {
      // Always preserve blank lines
      currentChunk.push(line);

      if (currentChunk.length > 0) {
        // Only count paragraphs for non-list content
        if (!inList) {
          paragraphCount++;
          const maxParagraphs = settings.paragraphsPerChunk || 1;

          if (paragraphCount >= maxParagraphs) {
            const nonEmptyLines = currentChunk.filter(l => l.trim()).length;
            if (nonEmptyLines >= (settings.minLines || 2)) {
              addChunk(currentChunk);
              currentChunk = [];
              paragraphCount = 0;
            }
          }
        }
      }
    } else {
      currentChunk.push(line);
    }
  }

  // Add any remaining content
  if (currentChunk.length > 0) {
    addChunk(currentChunk);
  }

  return chunks;
};

export const validateMarkdown = (markdown: string): boolean => {
  try {
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .parse(markdown);
    return true;
  } catch {
    return false;
  }
};