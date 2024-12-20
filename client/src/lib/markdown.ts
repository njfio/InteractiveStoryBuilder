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
      if (text && (!settings.minLines || text.split('\n').filter(line => line.trim()).length >= settings.minLines)) {
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
      saveCurrentChunk();
      const headerText = nodeLines.join('\n');

      if (node.depth === 1) {
        currentH1 = headerText.replace(/^#\s+/, '').trim();
        chunks.push({
          headingH1: currentH1,
          text: headerText,
          order: chunkOrder++
        });
      } else {
        currentChunkLines = [headerText];
      }
      currentChunkStart = end.line;
      return;
    }

    // Handle block content
    if (node.type === 'paragraph' || node.type === 'code' || node.type === 'blockquote') {
      // Only process root-level blocks
      if (!node.parent || node.parent.type === 'root') {
        saveCurrentChunk();
        currentChunkLines = nodeLines;
        saveCurrentChunk();
        currentChunkStart = end.line;
      }
    }
  });

  // Save any remaining content
  saveCurrentChunk();

  // Handle any trailing content
  const remainingLines = lines.slice(currentChunkStart);
  if (remainingLines.some(line => line.trim())) {
    const text = remainingLines.join('\n').trim();
    if (!settings.minLines || text.split('\n').filter(line => line.trim()).length >= settings.minLines) {
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