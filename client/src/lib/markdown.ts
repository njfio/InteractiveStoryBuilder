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
  let listContent: string[] = [];

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

    if (nonEmptyLines >= minLines || inList) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
  };

  const isListStart = (line: string) => {
    const trimmed = line.trim();
    return /^[-*+]|\d+\./.test(trimmed);
  };

  const isListContinuation = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // Empty lines within a list context are part of the list
    return /^\s+/.test(line) || isListStart(line); // Indented content or new list items
  };

  const processCurrentParagraph = () => {
    if (currentChunk.length > 0) {
      paragraphCount++;
      if (paragraphCount >= (settings.paragraphsPerChunk || 1)) {
        addChunk(currentChunk);
        currentChunk = [];
        paragraphCount = 0;
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const nextLine = lines[i + 1]?.trim();

    // Handle headings
    if (trimmedLine.startsWith('#')) {
      if (inList) {
        // Complete the current list
        currentChunk = [...listContent];
        addChunk(currentChunk);
        currentChunk = [];
        listContent = [];
        inList = false;
      } else if (currentChunk.length > 0) {
        processCurrentParagraph();
        addChunk(currentChunk);
        currentChunk = [];
      }

      if (trimmedLine.startsWith('# ')) {
        currentH1 = trimmedLine.replace(/^#\s+/, '');
        addChunk([line], true);
      } else {
        addChunk([line], true);
      }
      paragraphCount = 0;
      continue;
    }

    // Handle code blocks
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        if (inList) {
          currentChunk = [...listContent];
          addChunk(currentChunk);
          currentChunk = [];
          listContent = [];
          inList = false;
        } else if (currentChunk.length > 0) {
          processCurrentParagraph();
          addChunk(currentChunk);
          currentChunk = [];
        }
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
        }
      }
      paragraphCount = 0;
      continue;
    }

    if (inCodeBlock) {
      currentChunk.push(line);
      continue;
    }

    // Handle lists and paragraphs
    if (settings.preserveLists) {
      if (isListStart(line) && !inList) {
        // Start new list after completing current paragraph
        if (currentChunk.length > 0) {
          processCurrentParagraph();
          addChunk(currentChunk);
          currentChunk = [];
        }
        inList = true;
        listContent = [line];
      } else if (inList) {
        // Continue list
        if (isListContinuation(line) || !trimmedLine) {
          listContent.push(line);

          // Check if list is ending
          const nextNonEmptyLine = lines.slice(i + 1).find(l => l.trim());
          if (!nextNonEmptyLine || (!isListContinuation(nextNonEmptyLine) && !isListStart(nextNonEmptyLine))) {
            // Add the complete list as a chunk
            currentChunk = [...listContent];
            addChunk(currentChunk);
            currentChunk = [];
            listContent = [];
            inList = false;
            paragraphCount = 0;
          }
        } else {
          // List is ending because we found non-list content
          currentChunk = [...listContent];
          addChunk(currentChunk);
          currentChunk = [line];
          listContent = [];
          inList = false;
          paragraphCount = 1;
        }
      } else {
        // Handle regular paragraphs
        if (!trimmedLine) {
          if (currentChunk.length > 0) {
            currentChunk.push(line);
            processCurrentParagraph();
          }
        } else {
          currentChunk.push(line);
          if (!nextLine) {
            processCurrentParagraph();
          }
        }
      }
    } else {
      // When not preserving lists, treat everything as regular content
      if (!trimmedLine) {
        if (currentChunk.length > 0) {
          currentChunk.push(line);
          processCurrentParagraph();
        }
      } else {
        currentChunk.push(line);
        if (!nextLine) {
          processCurrentParagraph();
        }
      }
    }
  }

  // Handle any remaining content
  if (inList && listContent.length > 0) {
    currentChunk = [...listContent];
  }
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