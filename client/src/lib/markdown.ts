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

  const processParagraph = () => {
    if (currentChunk.length > 0) {
      paragraphCount++;
      const maxParagraphs = settings.paragraphsPerChunk || 1;

      if (paragraphCount >= maxParagraphs) {
        addChunk(currentChunk);
        currentChunk = [];
        paragraphCount = 0;
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Handle headings
    if (trimmedLine.startsWith('#')) {
      if (inList) {
        currentChunk.push(...listContent);
        listContent = [];
        inList = false;
        processParagraph();
      } else if (currentChunk.length > 0) {
        processParagraph();
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
          listContent = [];
          inList = false;
          processParagraph();
        } else if (currentChunk.length > 0) {
          processParagraph();
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

    // Handle lists and content
    if (settings.preserveLists) {
      if (isListStart(line) && !inList) {
        // Start new list
        if (currentChunk.length > 0) {
          processParagraph();
        }
        inList = true;
        listContent = [line];
      } else if (inList) {
        // Continue list
        listContent.push(line);

        // Check if list ends
        const nextLine = lines[i + 1]?.trim();
        if (!nextLine || (!isListStart(nextLine) && nextLine.length > 0 && !line.trim())) {
          currentChunk.push(...listContent);
          listContent = [];
          inList = false;
          processParagraph();
        }
      } else if (!trimmedLine) {
        // Handle blank lines outside lists
        if (currentChunk.length > 0) {
          currentChunk.push(line);
          if (!inList) {
            processParagraph();
          }
        }
      } else {
        // Regular content
        currentChunk.push(line);
      }
    } else {
      // When not preserving lists, treat everything as regular content
      if (!trimmedLine && currentChunk.length > 0) {
        currentChunk.push(line);
        processParagraph();
      } else if (trimmedLine) {
        currentChunk.push(line);
      }
    }
  }

  // Handle any remaining content
  if (inList && listContent.length > 0) {
    currentChunk.push(...listContent);
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