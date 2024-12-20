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
  let currentContent: string[] = [];
  let inList = false;
  let inCodeBlock = false;

  const isListStart = (line: string) => {
    const trimmed = line.trim();
    return /^[-*+]|\d+\./.test(trimmed);
  };

  const isListContinuation = (line: string) => {
    if (!line.trim()) return true; // Empty lines within list context
    return line.startsWith(' ') || isListStart(line); // Indented content or new list items
  };

  const addChunk = (content: string[]) => {
    const text = content.join('\n').trim();
    if (!text) return;

    // Count non-empty lines
    const nonEmptyLines = content.filter(line => line.trim()).length;
    const minLines = settings.minLines || 2;

    if (nonEmptyLines >= minLines || inList) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
  };

  const processCurrentContent = () => {
    if (currentContent.length > 0) {
      addChunk(currentContent);
      currentContent = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Handle code blocks
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        processCurrentContent();
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
        if (currentContent.length > 0) {
          addChunk(currentContent);
          currentContent = [];
        }
      }
      currentContent.push(line);
      continue;
    }

    if (inCodeBlock) {
      currentContent.push(line);
      continue;
    }

    // Handle headers
    if (trimmedLine.startsWith('#')) {
      processCurrentContent();

      if (trimmedLine.startsWith('# ')) {
        currentH1 = trimmedLine.replace(/^#\s+/, '');
        addChunk([line]);
      } else {
        addChunk([line]);
      }
      continue;
    }

    // Handle lists
    if (settings.preserveLists) {
      if (isListStart(line) && !inList) {
        // Start new list after completing current content
        processCurrentContent();
        inList = true;
        currentContent = [line];
      } else if (inList) {
        if (isListContinuation(line)) {
          currentContent.push(line);
        } else {
          // End of list
          processCurrentContent();
          inList = false;
          currentContent = [line];
        }
      } else {
        // Regular paragraph content
        if (!trimmedLine && currentContent.length > 0) {
          // Empty line after content - check if we need to create a new chunk
          currentContent.push(line);
          const nextLine = lines[i + 1]?.trim();
          if (nextLine && !nextLine.startsWith('#') && !isListStart(nextLine)) {
            // There's more paragraph content coming, continue
            continue;
          }
          processCurrentContent();
        } else if (trimmedLine) {
          currentContent.push(line);
        }
      }
    } else {
      // When not preserving lists, treat everything as regular content
      if (!trimmedLine && currentContent.length > 0) {
        currentContent.push(line);
        processCurrentContent();
      } else if (trimmedLine) {
        currentContent.push(line);
      }
    }
  }

  // Handle any remaining content
  if (currentContent.length > 0) {
    addChunk(currentContent);
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