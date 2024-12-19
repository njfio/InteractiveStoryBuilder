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
  let inChunk = false;

  // Function to get exact text from line numbers
  const getExactText = (start: number, end: number): string => {
    return lines.slice(start - 1, end).join('\n');
  };

  // Function to save current chunk
  const saveChunk = () => {
    if (currentLines.length > 0) {
      const text = currentLines.join('\n');
      if (text.trim()) {
        chunks.push({
          headingH1: currentH1,
          text,
          order: chunkOrder++
        });
      }
      currentLines = [];
      inChunk = false;
    }
  };

  // Process each node in document order
  visit(ast, (node: any) => {
    if (!node.position) return;

    if (node.type === 'heading') {
      // Always save current chunk before a heading
      saveChunk();

      const headingText = getExactText(
        node.position.start.line,
        node.position.end.line
      );

      if (node.depth === 1) {
        // For H1, just store it without including in chunk
        currentH1 = node.children.map((child: any) => child.value).join('').trim();
      } else {
        // For H2-H6, start new chunk with the heading
        currentLines.push(headingText);
        inChunk = true;
      }
    } else if (inChunk || node.type === 'paragraph' || node.type === 'list') {
      // Get exact text including whitespace
      const text = getExactText(
        node.position.start.line,
        node.position.end.line
      );

      // Add blank line before if needed
      if (currentLines.length > 0) {
        currentLines.push('');
      }

      // Add the text with original formatting
      currentLines.push(text);
      inChunk = true;
    }
  });

  // Save any remaining content
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