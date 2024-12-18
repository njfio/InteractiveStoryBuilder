import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { Node } from 'unist';

interface ChunkData {
  headingH1?: string; // Will store H3 titles
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

  visit(ast, (node: Node) => {
    if (node.type === 'heading' && 'depth' in node) {
      if (currentChunk.text) {
        chunks.push(currentChunk as ChunkData);
        currentChunk = { order: ++chunkOrder };
      }

      if (node.depth === 3) {
        if (currentChunk.text) {
          chunks.push(currentChunk as ChunkData);
          currentChunk = { order: ++chunkOrder };
        }
        currentChunk.headingH1 = getHeadingText(node);
      }
    } else if (node.type === 'paragraph') {
      if (currentChunk.text) {
        chunks.push(currentChunk as ChunkData);
        currentChunk = { 
          order: ++chunkOrder,
          headingH1: currentChunk.headingH1,
          headingH2: currentChunk.headingH2 
        };
      }
      currentChunk.text = getParagraphText(node);
    }
  });

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
