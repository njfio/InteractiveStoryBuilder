import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { Node } from 'unist';

interface ChunkData {
  headingH1?: string;
  text: string;
  order: number;
}

export const parseMarkdown = async (markdown: string): Promise<ChunkData[]> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const ast = await processor.parse(markdown);
  const chunks: ChunkData[] = [];
  let chunkOrder = 0;
  let currentH1: string | undefined;

  // Split markdown into lines for exact preservation
  const lines = markdown.split('\n');
  let currentChunkLines: string[] = [];
  let contentLineCount = 0;

  // Track nodes and their positions
  const nodePositions: Array<{ 
    node: Node, 
    start: number, 
    end: number 
  }> = [];

  // First pass: collect all node positions
  visit(ast, (node: any) => {
    if (node.position) {
      nodePositions.push({
        node,
        start: node.position.start.line - 1, // Convert to 0-based index
        end: node.position.end.line - 1
      });
    }
  });

  const saveChunk = (force = false) => {
    if (currentChunkLines.length === 0) return;

    // Count actual content lines (non-empty, non-whitespace)
    const contentLines = currentChunkLines.filter(line => line.trim()).length;

    // Only save chunks with enough content unless forced
    if (contentLines >= 4 || force) {
      // Preserve exact whitespace at chunk boundaries
      const text = currentChunkLines.join('\n');
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }

    currentChunkLines = [];
    contentLineCount = 0;
  };

  // Process nodes in order of appearance
  nodePositions.sort((a, b) => a.start - b.start);

  for (let i = 0; i < nodePositions.length; i++) {
    const { node, start, end } = nodePositions[i];

    // Handle H1 headers specially
    if (node.type === 'heading' && node.depth === 1) {
      // Save current chunk before new section
      saveChunk();

      // Update current H1 while preserving original formatting
      const headerLines = lines.slice(start, end + 1);
      currentH1 = headerLines.join('\n').replace(/^#+ /, '').trim();

      continue;
    }

    // Special handling for list structures
    if (node.type === 'list') {
      // Include the entire list as one unit
      const listLines = lines.slice(start, end + 1);
      currentChunkLines.push(...listLines);
      contentLineCount += listLines.filter(line => line.trim()).length;

      // Check if we should create a new chunk
      if (contentLineCount >= 4) {
        saveChunk();
      }
      continue;
    }

    // For all other nodes
    if (node.position) {
      const nodeLines = lines.slice(start, end + 1);

      // Add lines to current chunk
      currentChunkLines.push(...nodeLines);
      contentLineCount += nodeLines.filter(line => line.trim()).length;

      // Check for chunk boundary
      if (contentLineCount >= 4 && node.type === 'paragraph') {
        saveChunk();
      }
    }
  }

  // Save any remaining content
  saveChunk(true);

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