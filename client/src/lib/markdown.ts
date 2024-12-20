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

    if (nonEmptyLines >= minLines) {
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const nextLine = lines[i + 1]?.trim();

    // Handle headings
    if (trimmedLine.startsWith('#')) {
      if (inList) {
        // Finish current list before handling heading
        currentChunk.push(...listContent);
        addChunk(currentChunk);
        currentChunk = [];
        listContent = [];
        inList = false;
        paragraphCount = 0;
      } else if (currentChunk.length > 0) {
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
        if (inList) {
          currentChunk.push(...listContent);
          addChunk(currentChunk);
          currentChunk = [];
          listContent = [];
          inList = false;
        } else if (currentChunk.length > 0) {
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
      continue;
    }

    if (inCodeBlock) {
      currentChunk.push(line);
      continue;
    }

    // Handle lists and content
    if (settings.preserveLists) {
      if (isListStart(line) && !inList) {
        // Start new list
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
          paragraphCount = 0;
        }
        inList = true;
        listContent = [line];
      } else if (inList) {
        // Continue list if it's a list continuation or empty line
        if (isListContinuation(line) || !trimmedLine) {
          listContent.push(line);

          // Check if list is ending
          const nextNonEmptyLine = lines.slice(i + 1).find(l => l.trim());
          if (!nextNonEmptyLine || (!isListContinuation(nextNonEmptyLine) && !isListStart(nextNonEmptyLine))) {
            // List is ending, add it as a complete chunk
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
        if (!trimmedLine && currentChunk.length > 0) {
          currentChunk.push(line);
          paragraphCount++;
          if (paragraphCount >= (settings.paragraphsPerChunk || 1)) {
            addChunk(currentChunk);
            currentChunk = [];
            paragraphCount = 0;
          }
        } else if (trimmedLine) {
          currentChunk.push(line);
          paragraphCount++;
          if (paragraphCount >= (settings.paragraphsPerChunk || 1)) {
            addChunk(currentChunk);
            currentChunk = [];
            paragraphCount = 0;
          }
        }
      }
    } else {
      // When not preserving lists, treat everything as regular content
      if (!trimmedLine && currentChunk.length > 0) {
        currentChunk.push(line);
        paragraphCount++;
        if (paragraphCount >= (settings.paragraphsPerChunk || 1)) {
          addChunk(currentChunk);
          currentChunk = [];
          paragraphCount = 0;
        }
      } else if (trimmedLine) {
        currentChunk.push(line);
        paragraphCount++;
        if (paragraphCount >= (settings.paragraphsPerChunk || 1)) {
          addChunk(currentChunk);
          currentChunk = [];
          paragraphCount = 0;
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