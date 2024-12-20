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

    // Check if chunk meets minimum line requirement or is forced
    const nonEmptyLines = text.split('\n').filter(line => line.trim()).length;
    if (force || nonEmptyLines >= (settings.minLines || 2)) {
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
        addChunk(currentChunk, true);
        currentChunk = [];
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
        addChunk(currentChunk, true);
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
      if (currentChunk.length === 0 || currentChunk[currentChunk.length - 1].trim()) {
        currentChunk.push(line);
      } else {
        // If last line was blank, this is a new paragraph
        addChunk(currentChunk);
        currentChunk = [line];
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