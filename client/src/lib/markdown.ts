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
  let inList = false;
  const lines = markdown.split('\n');

  const isValidChunk = (text: string): boolean => {
    if (!text.trim()) return false;
    const nonEmptyLines = text.split('\n').filter(line => line.trim()).length;
    return nonEmptyLines >= (settings.minLines || 2);
  };

  const addChunk = (text: string) => {
    if (isValidChunk(text)) {
      chunks.push({
        headingH1: currentH1,
        text: text.trim(),
        order: chunkOrder++
      });
    }
  };

  visit(ast, (node: any) => {
    if (!node.position) return;

    const { start, end } = node.position;
    const nodeText = lines.slice(start.line - 1, end.line).join('\n');

    // Handle headings
    if (node.type === 'heading') {
      if (node.depth === 1) {
        currentH1 = nodeText.replace(/^#\s+/, '').trim();
        addChunk(nodeText);
      } else {
        addChunk(nodeText);
      }
      return;
    }

    // Handle lists
    if (node.type === 'list' || node.parent?.type === 'list') {
      if (settings.preserveLists) {
        if (!inList) {
          inList = true;
          addChunk(nodeText);
        }
      } else {
        addChunk(nodeText);
      }
      return;
    }

    // Reset list context
    if (inList && node.type !== 'list' && node.parent?.type !== 'list') {
      inList = false;
    }

    // Handle paragraphs and other block content
    if ((node.type === 'paragraph' || node.type === 'blockquote') && 
        (!node.parent || node.parent.type === 'root')) {
      addChunk(nodeText);
      return;
    }

    // Handle code blocks
    if (node.type === 'code') {
      addChunk(nodeText);
      return;
    }
  });

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