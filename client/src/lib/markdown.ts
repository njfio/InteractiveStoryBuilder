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
  let currentChunk: string[] = [];
  let lastNodeWasHeading = false;

  // Function to save current chunk if it contains content
  const saveChunk = () => {
    if (currentChunk.length === 0) return;

    const text = currentChunk.join('\n');
    if (text.trim()) {
      chunks.push({
        headingH1: currentH1,
        text,
        order: chunkOrder++
      });
    }
    currentChunk = [];
    lastNodeWasHeading = false;
  };

  // Process each node in document order
  visit(ast, (node: any, index: number, parent: any) => {
    // Skip if we're inside a heading (to avoid duplicate content)
    if (parent?.type === 'heading') return;

    if (node.type === 'heading') {
      // Always start a new chunk at a heading
      if (!lastNodeWasHeading) {
        saveChunk();
      }

      // Get the original heading text with markdown syntax
      const headingLines = lines.slice(
        node.position.start.line - 1,
        node.position.end.line
      );

      // For H1, update the current H1 and don't include in chunk
      if (node.depth === 1) {
        currentH1 = node.children
          .map((child: any) => child.value)
          .join('')
          .trim();
        lastNodeWasHeading = false;
        return;
      }

      // For other headings, include in chunk
      currentChunk.push(...headingLines);
      lastNodeWasHeading = true;
    } else if (node.type === 'paragraph' || node.type === 'list') {
      // Get the original text with exact formatting
      const contentLines = lines.slice(
        node.position.start.line - 1,
        node.position.end.line
      );

      // Add proper spacing
      if (currentChunk.length > 0 && !lastNodeWasHeading) {
        currentChunk.push('');  // Add blank line between paragraphs
      }

      currentChunk.push(...contentLines);

      // If this was after a heading, save the chunk
      if (lastNodeWasHeading) {
        saveChunk();
      }
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