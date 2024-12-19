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

    // Rule 7: Don't create single-line chunks unless it's a heading or forced
    if (!force && trimmedText.split('\n').filter(line => line.trim()).length === 1 && !currentH1) return;

    // Rule 4: Avoid over-fragmentation - don't create tiny chunks
    if (!force && trimmedText.split('\n\n').length < 2) return;

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
        // Save existing content before starting new section
        if (currentText) {
          saveChunk(currentText);
        }
        
        // Reset state for new section
        currentText = '';
        paragraphCount = 0;
        isSpecialSection = false;
        
        // Update current H1 without creating separate chunk
        currentH1 = getHeadingText(node).replace(/^\*\*(.*)\*\*$/, '$1').trim();
        currentText = `# ${currentH1}\n\n`; // Include header in the content
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

      // Add paragraph to current chunk with proper formatting
      if (currentText && !currentText.endsWith('\n\n')) {
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
    }
  });

  // Save the final chunk if there's any content
  if (currentText) {
    saveChunk(currentText);
  }

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
    // Add spaces only between text nodes, not at the end
    if (text && !text.endsWith(' ')) {
      text += ' ';
    }
    text += textNode.value;
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
