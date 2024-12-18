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
  let currentText = '';

  const saveChunk = (text: string) => {
    if (text.trim()) {
      chunks.push({
        headingH1: currentH1,
        text: text.trim(),
        order: chunkOrder++
      });
    }
  };

  visit(ast, (node: Node) => {
    if (node.type === 'heading' && 'depth' in node) {
      if (node.depth === 1) {
        // Save previous chunk if exists
        saveChunk(currentText);
        currentText = '';
        // Update current H1
        currentH1 = getHeadingText(node).replace(/^\*\*(.*)\*\*$/, '$1').trim();
        // Create a chunk for the header itself
        saveChunk(currentH1);
      }
    } else if (node.type === 'paragraph') {
      const paragraphText = getParagraphText(node);
      if (currentText) {
        // Save previous paragraph as its own chunk
        saveChunk(currentText);
        currentText = '';
      }
      currentText = paragraphText;
    }
  });

  // Save the final chunk if there's any content
  saveChunk(currentText);

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
