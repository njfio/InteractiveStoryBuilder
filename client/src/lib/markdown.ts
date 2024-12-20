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
  let currentChunkLines: string[] = [];
  let inList = false;
  let isCodeBlock = false;

  const isValidChunk = (text: string): boolean => {
    if (!text.trim()) return false;
    if (!settings.minLines) return true;
    const nonEmptyLines = text.split('\n').filter(line => line.trim()).length;
    return nonEmptyLines >= settings.minLines;
  };

  const saveCurrentChunk = () => {
    if (currentChunkLines.length > 0) {
      const text = currentChunkLines.join('\n').trim();
      if (isValidChunk(text)) {
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
    const nodeText = nodeLines.join('\n');

    // Handle headings first
    if (node.type === 'heading') {
      saveCurrentChunk();
      if (node.depth === 1) {
        currentH1 = nodeText.replace(/^#\s+/, '').trim();
        chunks.push({
          headingH1: currentH1,
          text: nodeText,
          order: chunkOrder++
        });
      } else {
        // Other headings start new chunks
        currentChunkLines = [nodeText];
      }
      return;
    }

    // Handle code blocks
    if (node.type === 'code') {
      saveCurrentChunk();
      if (isValidChunk(nodeText)) {
        chunks.push({
          headingH1: currentH1,
          text: nodeText,
          order: chunkOrder++
        });
      }
      return;
    }

    // Handle lists based on preserveLists setting
    if (node.type === 'list' || node.parent?.type === 'list') {
      if (settings.preserveLists) {
        if (!inList) {
          saveCurrentChunk();
          inList = true;
        }
        currentChunkLines.push(...nodeLines);
      } else {
        // If not preserving lists, treat each list item as potential chunk
        if (isValidChunk(nodeText)) {
          saveCurrentChunk();
          currentChunkLines = nodeLines;
          saveCurrentChunk();
        }
      }
      return;
    }

    // End list context
    if (inList && node.type !== 'list' && node.parent?.type !== 'list') {
      inList = false;
      saveCurrentChunk();
    }

    // Handle paragraphs and other block content
    if ((node.type === 'paragraph' || node.type === 'blockquote') && 
        (!node.parent || node.parent.type === 'root')) {
      if (!inList) {
        saveCurrentChunk();
        if (isValidChunk(nodeText)) {
          currentChunkLines = nodeLines;
          saveCurrentChunk();
        } else {
          // Accumulate content until we reach minLines
          currentChunkLines.push(...nodeLines);
        }
      }
    }
  });

  // Save any remaining content
  saveCurrentChunk();

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