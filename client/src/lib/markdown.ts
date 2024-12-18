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
  let currentText = '';
  let lastH1: string | undefined;

  visit(ast, (node: Node) => {
    if (node.type === 'heading' && 'depth' in node) {
      if (node.depth === 1) {
        // When we hit a new H1, save the previous chunk if it exists
        if (currentText) {
          chunks.push({
            headingH1: lastH1,
            text: currentText.trim(),
            order: chunkOrder++
          });
          currentText = '';
        }
        lastH1 = getHeadingText(node).replace(/^\*\*(.*)\*\*$/, '$1').trim();
      }
    } else if (node.type === 'paragraph') {
      const paragraphText = getParagraphText(node);
      currentText += (currentText ? '\n\n' : '') + paragraphText;
    }
  });

  // Don't forget the last chunk
  if (currentText) {
    chunks.push({
      headingH1: lastH1,
      text: currentText.trim(),
      order: chunkOrder
    });
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
