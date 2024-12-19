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
  let lineCount = 0;

  const isActivityOrSummary = (text: string): boolean => {
    const keywords = ['Activity', 'Summary', 'Exercise'];
    return keywords.some(keyword => text.startsWith(keyword));
  };

  const countTextLines = (text: string): number => {
    return text.split('\n').filter(line => line.trim()).length;
  };

  const saveChunk = (text: string, force: boolean = false) => {
    // Remove leading/trailing empty lines but preserve internal formatting
    const trimmedText = text.replace(/^\n+|\n+$/g, '');
    if (!trimmedText) return;

    // Don't create chunks with less than 4 lines unless forced
    if (!force && countTextLines(trimmedText) < 4) return;

    chunks.push({
      headingH1: currentH1,
      text: trimmedText,
      order: chunkOrder++
    });
  };

  visit(ast, (node: Node) => {
    if (node.type === 'heading' && 'depth' in node) {
      if (node.depth === 1) {
        // Save existing content before starting new section
        if (currentText && countTextLines(currentText) >= 4) {
          saveChunk(currentText);
        }

        // Reset state for new section
        currentText = '';
        lineCount = 0;

        // Update current H1 without including it in the content
        currentH1 = getHeadingText(node).replace(/^\*\*(.*)\*\*$/, '$1').trim();
      } else {
        // For other heading levels, preserve the markdown syntax
        if (currentText && !currentText.endsWith('\n\n')) {
          currentText += '\n\n';
        }
        currentText += `${'#'.repeat((node as any).depth)} ${getHeadingText(node)}\n`;
        lineCount++;
      }
    } else if (node.type === 'list') {
      // Preserve list formatting
      if (currentText && !currentText.endsWith('\n\n')) {
        currentText += '\n\n';
      }
      const listItems = [];
      visit(node, 'listItem', (item: any) => {
        let itemText = '';
        visit(item, 'paragraph', (p: any) => {
          itemText += getParagraphText(p);
        });
        listItems.push(itemText);
      });
      const isOrdered = (node as any).ordered;
      currentText += listItems.map((item, index) => 
        `${isOrdered ? `${index + 1}.` : '-'} ${item}`
      ).join('\n');
      lineCount += listItems.length;
    } else if (node.type === 'paragraph') {
      const paragraphText = getParagraphText(node);
      const paragraphLines = countTextLines(paragraphText);

      // Special sections should stay together
      if (isActivityOrSummary(paragraphText)) {
        if (currentText) {
          saveChunk(currentText);
        }
        currentText = paragraphText;
        lineCount = paragraphLines;
        return;
      }

      // Add paragraph to current chunk with proper formatting
      if (currentText && !currentText.endsWith('\n\n')) {
        currentText += '\n\n';
      }
      currentText += paragraphText;
      lineCount += paragraphLines;

      // Create a new chunk if we have enough lines
      if (lineCount >= 4) {
        saveChunk(currentText);
        currentText = '';
        lineCount = 0;
      }
    } else if (node.type === 'text' || node.type === 'break') {
      // Preserve standalone text nodes and line breaks
      if (currentText && !currentText.endsWith('\n')) {
        currentText += '\n';
      }
      if (node.type === 'text') {
        currentText += (node as any).value;
        lineCount += countTextLines((node as any).value);
      } else {
        currentText += '\n';
      }
    }
  });

  // Save the final chunk if there's any content
  if (currentText) {
    saveChunk(currentText, true);
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
  let lastNode: any;

  visit(node, (childNode: any) => {
    if (childNode.type === 'text') {
      // Add space between text nodes if needed
      if (text && !text.endsWith(' ') && !childNode.value.startsWith(' ')) {
        text += ' ';
      }
      text += childNode.value;
    } else if (childNode.type === 'break') {
      text += '\n';
    }
    lastNode = childNode;
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