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
  let currentChunk: Partial<ChunkData> = { order: 0 };
  let chunkOrder = 0;
  let currentH1: string | undefined;

  visit(ast, (node: Node) => {
    if (node.type === 'heading' && 'depth' in node) {
      // When we encounter an H1, store it for subsequent chunks
      if (node.depth === 1) {
        currentH1 = getHeadingText(node);
        // Don't create a chunk for just the heading
        return;
      }
    } else if (node.type === 'paragraph') {
      // If we already have text in the current chunk, create a new one
      if (currentChunk.text) {
        chunks.push(currentChunk as ChunkData);
        currentChunk = { 
          order: ++chunkOrder,
          headingH1: currentH1 // Carry forward the current H1
        };
      } else if (!currentChunk.headingH1) {
        // If this is a new chunk without a heading, use the current H1
        currentChunk.headingH1 = currentH1;
      }
      
      currentChunk.text = getParagraphText(node);
    }
  });

  // Don't forget the last chunk if it has content
  if (currentChunk.text) {
    chunks.push(currentChunk as ChunkData);
  }

  return chunks;
};

const getHeadingText = (node: Node): string => {
  let text = '';
  visit(node, 'text', (textNode: { value: string }) => {
    text += textNode.value;
  });
  return text;
};

const getParagraphText = (node: Node): string => {
  let text = '';
  visit(node, 'text', (textNode: { value: string }) => {
    text += textNode.value + ' ';
  });
  return text.trim();
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
