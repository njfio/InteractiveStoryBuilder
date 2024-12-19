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
  let currentChunkLines = 0;
  let preservingSpecialSection = false;

  const countContentLines = (text: string): number => {
    return text.split('\n').filter(line => line.trim()).length;
  };

  const saveChunk = (text: string, force: boolean = false) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Don't create chunks with less than 4 content lines unless forced
    if (!force && countContentLines(trimmedText) < 4) return;

    chunks.push({
      headingH1: currentH1,
      text: trimmedText,
      order: chunkOrder++
    });
  };

  let lastNode: Node | null = null;
  let inList = false;

  visit(ast, (node: Node) => {
    // Add appropriate spacing between different node types
    if (lastNode && currentText && !preservingSpecialSection) {
      if (node.type !== 'listItem' && lastNode.type !== 'listItem') {
        if (!currentText.endsWith('\n\n')) {
          currentText += '\n\n';
        }
      } else if (node.type === 'listItem' && !currentText.endsWith('\n')) {
        currentText += '\n';
      }
    }

    if (node.type === 'heading' && 'depth' in node) {
      if (node.depth === 1) {
        // Save previous chunk if it has enough content
        if (currentText && countContentLines(currentText) >= 4) {
          saveChunk(currentText);
        }

        // Reset state for new section
        currentText = '';
        currentChunkLines = 0;
        preservingSpecialSection = false;
        currentH1 = getHeadingText(node);
      } else {
        // Preserve exact heading formatting
        currentText += `${'#'.repeat((node as any).depth)} ${getHeadingText(node)}\n`;
        currentChunkLines++;
      }
    } else if (node.type === 'list') {
      inList = true;
    } else if (node.type === 'listItem' && inList) {
      // Only process list items when inside a list
      const parent = (node as any).parent;
      if (!parent || parent.type !== 'list') return;

      const isOrdered = parent.ordered;
      const listIndex = isOrdered ? ((parent.start || 1) + (node as any).index) : null;
      const prefix = isOrdered ? `${listIndex}.` : '-';

      let itemText = '';
      visit(node, 'paragraph', (p: any) => {
        itemText += getParagraphText(p);
      });

      currentText += `${prefix} ${itemText}\n`;
      currentChunkLines++;
    } else if (node.type === 'paragraph') {
      const paragraphText = getParagraphText(node);
      const contentLines = countContentLines(paragraphText);

      // Check for special sections
      if (!preservingSpecialSection && isActivityOrSummary(paragraphText)) {
        if (currentText && countContentLines(currentText) >= 4) {
          saveChunk(currentText);
        }
        currentText = paragraphText;
        currentChunkLines = contentLines;
        preservingSpecialSection = true;
        return;
      }

      currentText += paragraphText;
      currentChunkLines += contentLines;

      // Create new chunk if we have enough content
      if (!preservingSpecialSection && !inList && currentChunkLines >= 4) {
        saveChunk(currentText);
        currentText = '';
        currentChunkLines = 0;
      }
    }

    lastNode = node;
    if (node.type === 'list') {
      inList = false;
    }
  });

  // Save final chunk if it has content
  if (currentText) {
    saveChunk(currentText, true);
  }

  return chunks;
};

const isActivityOrSummary = (text: string): boolean => {
  const keywords = ['Activity', 'Summary', 'Exercise'];
  return keywords.some(keyword => text.startsWith(keyword));
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

  visit(node, (childNode: any) => {
    if (childNode.type === 'text') {
      // Preserve exact spacing
      if (text && !text.endsWith(' ') && !childNode.value.startsWith(' ')) {
        text += ' ';
      }
      text += childNode.value;
    } else if (childNode.type === 'break') {
      text += '\n';
    }
  });

  return text;
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