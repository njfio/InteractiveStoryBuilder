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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

    // Handle headings
    if (trimmedLine.startsWith('#')) {
      // Add any accumulated content before processing the heading
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

    // Handle paragraphs and blank lines
    if (!trimmedLine) {
      // Always preserve the blank line in the current chunk
      currentChunk.push(line);

      if (currentChunk.length > 0) {
        // Increment paragraph count when we hit a blank line
        paragraphCount++;
        const maxParagraphs = settings.paragraphsPerChunk || 1;

        // Check if we've accumulated enough paragraphs
        if (paragraphCount >= maxParagraphs) {
          // Only create chunk if it meets minimum line requirement
          const nonEmptyLines = currentChunk.filter(l => l.trim()).length;
          if (nonEmptyLines >= (settings.minLines || 2)) {
            addChunk(currentChunk);
            currentChunk = [];
            paragraphCount = 0;
          }
        }
      }
    } else {
      // Add the line to current chunk
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