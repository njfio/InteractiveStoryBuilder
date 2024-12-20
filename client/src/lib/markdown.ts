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
  let lastLineWasEmpty = false;

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

  const shouldCreateNewChunk = () => {
    const maxParagraphs = settings.paragraphsPerChunk || 1;
    return paragraphCount >= maxParagraphs;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const nextLine = lines[i + 1]?.trim();

    // Handle headings
    if (trimmedLine.startsWith('#')) {
      if (inList) {
        // Finish the current list
        currentChunk.push(...listContent);
        listContent = [];
        inList = false;
        if (shouldCreateNewChunk()) {
          addChunk(currentChunk);
          currentChunk = [];
          paragraphCount = 0;
        }
      } else if (currentChunk.length > 0) {
        // Add current content as chunk
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
          listContent = [];
          inList = false;
          if (shouldCreateNewChunk()) {
            addChunk(currentChunk);
            currentChunk = [];
            paragraphCount = 0;
          }
        } else if (currentChunk.length > 0) {
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

    // Handle lists and content
    if (settings.preserveLists) {
      if (isListStart(line) && !inList) {
        // Start new list
        if (currentChunk.length > 0) {
          // Complete current paragraph before starting list
          if (shouldCreateNewChunk()) {
            addChunk(currentChunk);
            currentChunk = [];
            paragraphCount = 0;
          }
        }
        inList = true;
        listContent = [line];
      } else if (inList) {
        // Continue list
        listContent.push(line);

        // Check if list ends
        if (!nextLine || (!isListStart(nextLine) && !line.trim() && !isListStart(lines[i + 2]?.trim()))) {
          // Add list as a single paragraph
          currentChunk.push(...listContent);
          listContent = [];
          inList = false;
          paragraphCount++;

          if (shouldCreateNewChunk()) {
            addChunk(currentChunk);
            currentChunk = [];
            paragraphCount = 0;
          }
        }
      } else {
        // Handle regular content
        if (!trimmedLine && currentChunk.length > 0) {
          // Blank line after content indicates paragraph end
          currentChunk.push(line);
          if (!lastLineWasEmpty) {
            paragraphCount++;
            if (shouldCreateNewChunk()) {
              addChunk(currentChunk);
              currentChunk = [];
              paragraphCount = 0;
            }
          }
          lastLineWasEmpty = true;
        } else if (trimmedLine) {
          currentChunk.push(line);
          lastLineWasEmpty = false;
        }
      }
    } else {
      // When not preserving lists, treat everything as regular content
      if (!trimmedLine && currentChunk.length > 0) {
        currentChunk.push(line);
        if (!lastLineWasEmpty) {
          paragraphCount++;
          if (shouldCreateNewChunk()) {
            addChunk(currentChunk);
            currentChunk = [];
            paragraphCount = 0;
          }
        }
        lastLineWasEmpty = true;
      } else if (trimmedLine) {
        currentChunk.push(line);
        lastLineWasEmpty = false;
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