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
}

export const parseMarkdown = async (
  markdown: string,
  settings: ChunkSettings = { preserveLists: true, minLines: 2 }
): Promise<ChunkData[]> => {
  const chunks: ChunkData[] = [];
  let currentH1: string | undefined;
  let chunkOrder = 0;

  // Split content into lines
  const lines = markdown.split('\n');
  let currentChunk: string[] = [];
  let inList = false;
  let inCodeBlock = false;

  const addChunk = (lines: string[], force = false) => {
    const text = lines.join('\n').trim();
    if (!text) return;

    // Check if chunk meets minimum line requirement
    const nonEmptyLines = text.split('\n').filter(line => line.trim()).length;
    const minLines = settings.minLines || 2;

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
    if (nonEmptyLines >= minLines) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

    // Handle headings
    if (trimmedLine.startsWith('#')) {
      if (currentChunk.length > 0) {
        addChunk(currentChunk);
        currentChunk = [];
      }

      if (trimmedLine.startsWith('# ')) {
        currentH1 = trimmedLine.replace(/^#\s+/, '');
        addChunk([line], true);
      } else {
        currentChunk = [line];
        // Accumulate content after subheadings until minimum lines are met
        let j = i + 1;
        while (j < lines.length && currentChunk.length < (settings.minLines || 2) * 2) {
          if (!lines[j].trim().startsWith('#')) {
            currentChunk.push(lines[j]);
          } else {
            break;
          }
          j++;
        }
        addChunk(currentChunk);
        currentChunk = [];
        i = j - 1;
      }
      continue;
    }

    // Handle code blocks
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
        }
        inCodeBlock = true;
        currentChunk = [line];
      } else {
        inCodeBlock = false;
        currentChunk.push(line);
        addChunk(currentChunk);
        currentChunk = [];
      }
      continue;
    }

    if (inCodeBlock) {
      currentChunk.push(line);
      continue;
    }

    // Handle lists
    const isListItem = /^[-*+]|\d+\./.test(trimmedLine);
    if (isListItem) {
      if (!inList && settings.preserveLists) {
        if (currentChunk.length > 0) {
          addChunk(currentChunk);
          currentChunk = [];
        }
        inList = true;
      }
      currentChunk.push(line);
      continue;
    }

    // Handle end of lists
    if (inList && !trimmedLine && settings.preserveLists) {
      if (!nextLine || !/^[-*+]|\d+\./.test(nextLine)) {
        inList = false;
        addChunk(currentChunk);
        currentChunk = [];
      }
      continue;
    }

    // Handle paragraphs and blank lines
    if (!trimmedLine) {
      if (currentChunk.length > 0 && (!inList || !settings.preserveLists)) {
        addChunk(currentChunk);
        currentChunk = [];
      }
    } else {
      // Continue accumulating content for the current chunk
      currentChunk.push(line);

      // Look ahead to see if we have a paragraph boundary
      if (!nextLine) {
        addChunk(currentChunk);
        currentChunk = [];
      }
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