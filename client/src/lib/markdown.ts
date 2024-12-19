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
  let paragraphCount = 0;
  let isSpecialSection = false;

  const isActivityOrSummary = (text: string): boolean => {
    const keywords = ['Activity', 'Summary', 'Exercise'];
    return keywords.some(keyword => text.startsWith(keyword));
  };

  const saveChunk = (text: string, force: boolean = false) => {
    // Remove leading/trailing empty lines but preserve internal formatting
    const trimmedText = text.replace(/^\n+|\n+$/g, '');
    if (!trimmedText) return;

    // Rule 7: Don't create single-line chunks unless it's a heading
    if (!force && trimmedText.split('\n').filter(line => line.trim()).length === 1 && !currentH1) return;

    // Rule 4: Avoid over-fragmentation
    if (!force && trimmedText.split('\n\n').length < 2) return;

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
        if (currentText) {
          saveChunk(currentText);
        }
        
        // Reset state for new section
        currentText = '';
        paragraphCount = 0;
        isSpecialSection = false;
        
        // Update current H1 without including it in the content
        currentH1 = getHeadingText(node).replace(/^\*\*(.*)\*\*$/, '$1').trim();
      }
    } else if (node.type === 'paragraph') {
      const paragraphText = getParagraphText(node);
      
      // Rule 3: Check for activity or summary sections
      if (!isActivityOrSummary(paragraphText)) {
        if (currentText) {
          currentText += '\n\n';
        }
        currentText += paragraphText;
        paragraphCount++;

        // Rule 2: Each chunk should have 4-6 paragraphs
        if (!isSpecialSection && paragraphCount >= 5) {
          saveChunk(currentText);
          currentText = '';
          paragraphCount = 0;
        }
      } else {
        // Save current content before starting special section
        if (currentText) {
          saveChunk(currentText);
        }
        currentText = paragraphText;
        isSpecialSection = true;
      }
    } else if (node.type === 'text' || node.type === 'break') {
      // Preserve standalone text nodes and line breaks
      if (currentText && !currentText.endsWith('\n')) {
        currentText += '\n';
      }
      if (node.type === 'text') {
        currentText += (node as any).value;
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
