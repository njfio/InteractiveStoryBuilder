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
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Rule 7: Don't create single-line chunks unless it's a heading
    if (!force && trimmedText.split('\n').length === 1 && !currentH1) return;

    chunks.push({
      headingH1: currentH1,
      text: trimmedText,
      order: chunkOrder++
    });
  };

  const shouldStartNewChunk = (): boolean => {
    // Rule 2: Each chunk should have 4-6 paragraphs max
    if (paragraphCount >= 5) return true;
    
    // Rule 3: Special sections should stay intact
    if (isSpecialSection) return false;

    return false;
  };

  visit(ast, (node: Node) => {
    if (node.type === 'heading' && 'depth' in node) {
      if (node.depth === 1) {
        // Rule 3: Never split headings
        if (currentText) {
          saveChunk(currentText);
        }
        currentText = '';
        paragraphCount = 0;
        
        // Update current H1
        currentH1 = getHeadingText(node).replace(/^\*\*(.*)\*\*$/, '$1').trim();
        // Create a chunk for the header itself
        saveChunk(currentH1, true);
        
        // Reset special section flag for new major section
        isSpecialSection = false;
      }
    } else if (node.type === 'paragraph') {
      const paragraphText = getParagraphText(node);
      
      // Rule 3: Check for activity or summary sections
      if (!isSpecialSection && isActivityOrSummary(paragraphText)) {
        if (currentText) {
          saveChunk(currentText);
        }
        currentText = '';
        paragraphCount = 0;
        isSpecialSection = true;
      }

      // Add paragraph to current chunk
      if (currentText) currentText += '\n\n';
      currentText += paragraphText;
      paragraphCount++;

      // Check if we should start a new chunk
      if (!isSpecialSection && shouldStartNewChunk()) {
        saveChunk(currentText);
        currentText = '';
        paragraphCount = 0;
      }
    }
  });

  // Save the final chunk if there's any content
  if (currentText) {
    saveChunk(currentText);
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
