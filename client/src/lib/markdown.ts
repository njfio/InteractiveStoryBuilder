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

  // Track current chunk building
  let currentLines: string[] = [];
  let processedLines = new Set<number>();

  // Function to get exact text from line numbers
  const getExactText = (start: number, end: number): string => {
    // Only get lines we haven't processed yet
    const textLines = [];
    for (let i = start - 1; i < end; i++) {
      if (!processedLines.has(i)) {
        textLines.push(lines[i]);
        processedLines.add(i);
      }
    }
    return textLines.join('\n');
  };

  // Function to save current chunk
  const saveChunk = () => {
    if (currentLines.length > 0) {
      const text = currentLines.join('\n').trim();
      if (text) {
        chunks.push({
          headingH1: currentH1,
          text,
          order: chunkOrder++
        });
      }
      currentLines = [];
    }
  };

  // First pass: Mark all heading positions
  const headings = new Map<number, { depth: number; node: any }>();
  visit(ast, 'heading', (node: any) => {
    if (node.position) {
      headings.set(node.position.start.line, { depth: node.depth, node });
    }
  });

  // Second pass: Process content with awareness of heading boundaries
  let lastNodeEnd = 0;
  visit(ast, (node: any) => {
    if (!node.position) return;
    const start = node.position.start.line;
    const end = node.position.end.line;

    // Skip if we've already processed these lines
    if ([...processedLines].some(line => line >= start - 1 && line < end)) {
      return;
    }

    // Handle headings specially
    if (node.type === 'heading') {
      // Always save current chunk before a heading
      saveChunk();

      const headingText = node.children.map((child: any) => child.value).join('').trim();

      if (node.depth === 1) {
        currentH1 = headingText;
      } else {
        // For non-H1 headings, include them in the chunk with proper markdown syntax
        currentLines.push(`${'#'.repeat(node.depth)} ${headingText}`);
      }

      return;
    }

    // Add content to current chunk
    const text = getExactText(start, end);
    if (text.trim()) {
      if (currentLines.length > 0) {
        currentLines.push(''); // Add blank line between content blocks
      }
      currentLines.push(text);

      // Check if we should create a new chunk
      if (node.type === 'paragraph' && !node.parent?.type?.match(/list|blockquote/)) {
        saveChunk();
      }
    }

    lastNodeEnd = end;
  });

  // Save final chunk
  saveChunk();

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