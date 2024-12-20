import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

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
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const ast = await processor.parse(markdown);
  const chunks: ChunkData[] = [];
  let currentH1: string | undefined;
  let chunkOrder = 0;

  // Split markdown into lines for exact text preservation
  const lines = markdown.split('\n');
  let currentChunkStart = 0;
  let currentChunkLines: string[] = [];
  let inList = false;

  const saveCurrentChunk = () => {
    if (currentChunkLines.length > 0) {
      const text = currentChunkLines.join('\n').trim();
      if (text && (!settings.minLines || text.split('\n').length >= settings.minLines)) {
        chunks.push({
          headingH1: currentH1,
          text,
          order: chunkOrder++
        });
      }
      currentChunkLines = [];
    }
  };

  // Process nodes
  visit(ast, (node: any) => {
    if (!node.position) return;

    const { start, end } = node.position;
    const nodeLines = lines.slice(start.line - 1, end.line);

    // Handle lists specially if preserveLists is enabled
    if (settings.preserveLists && (node.type === 'list' || node.parent?.type === 'list')) {
      if (!inList) {
        saveCurrentChunk(); // Save any pending content before the list
        inList = true;
      }
      currentChunkLines.push(...nodeLines);
      return;
    }

    // End list context if we're not in a list anymore
    if (inList && node.type !== 'list' && node.parent?.type !== 'list') {
      inList = false;
      saveCurrentChunk();
    }

    // Handle headers
    if (node.type === 'heading') {
      // Save current chunk before starting a new one at header
      saveCurrentChunk();

      const headerText = nodeLines.join('\n');

      if (node.depth === 1) {
        // For H1, update current H1 and create a chunk for the header itself
        currentH1 = headerText.replace(/^#\s+/, '').trim();
        chunks.push({
          headingH1: currentH1,
          text: headerText,
          order: chunkOrder++
        });
      } else {
        // For other headers, start a new chunk with the header
        currentChunkLines = [headerText];
      }
      currentChunkStart = end.line;
      return;
    }

    // Handle paragraphs and other block content
    if (node.type === 'paragraph' || node.type === 'code' || node.type === 'list') {
      // If there's a gap between the last node and this one, preserve it
      if (currentChunkStart < start.line - 1) {
        const gap = lines.slice(currentChunkStart, start.line - 1);
        if (gap.some(line => line.trim())) {
          currentChunkLines.push(...gap);
        }
      }

      currentChunkLines.push(...nodeLines);

      // Only create new chunks for standalone paragraphs
      if (node.type === 'paragraph' && !node.parent?.type?.match(/list|blockquote/)) {
        saveCurrentChunk();
      }

      currentChunkStart = end.line;
    }
  });

  // Save any remaining content
  saveCurrentChunk();

  // Handle any trailing content
  const remainingLines = lines.slice(currentChunkStart);
  if (remainingLines.some(line => line.trim())) {
    const text = remainingLines.join('\n').trim();
    if (!settings.minLines || text.split('\n').length >= settings.minLines) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
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