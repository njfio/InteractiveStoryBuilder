import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { parseMarkdown } from '@/lib/markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ChevronDownCircle, ChevronUpCircle } from 'lucide-react';

interface ChunkPreviewProps {
  markdown: string;
  onChange?: (chunks: any[]) => void;
  onChunkSelect?: (chunkText: string) => void;
}

export function ChunkPreview({ markdown, onChange, onChunkSelect }: ChunkPreviewProps) {
  const [chunks, setChunks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  useEffect(() => {
    if (!markdown) {
      setChunks([]);
      return;
    }

    const parseContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const parsedChunks = await parseMarkdown(markdown);
        setChunks(parsedChunks);
        onChange?.(parsedChunks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse markdown');
      } finally {
        setLoading(false);
      }
    };

    parseContent();
  }, [markdown, onChange]);

  const toggleAllChunks = () => {
    if (expandedItems.length === chunks.length) {
      setExpandedItems([]);
    } else {
      setExpandedItems(chunks.map((_, index) => index.toString()));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!chunks.length) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Start typing to see content chunks...
      </div>
    );
  }

  const isAllExpanded = expandedItems.length === chunks.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Content Chunks ({chunks.length})</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={toggleAllChunks}
        >
          {isAllExpanded ? (
            <>
              <ChevronUpCircle className="mr-2 h-4 w-4" />
              Collapse All
            </>
          ) : (
            <>
              <ChevronDownCircle className="mr-2 h-4 w-4" />
              Expand All
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <Accordion
            type="multiple"
            value={expandedItems}
            onValueChange={setExpandedItems}
            className="w-full"
          >
            {chunks.map((chunk, index) => (
              <AccordionItem 
                key={index} 
                value={index.toString()}
                className="border-b last:border-0"
              >
                <AccordionTrigger
                  onClick={() => onChunkSelect?.(chunk.text)}
                  className="text-sm hover:bg-muted/50 px-4 -mx-4"
                >
                  {chunk.headingH1 ? (
                    <span className="font-semibold">{chunk.headingH1}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Chunk {index + 1}
                    </span>
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <div className="font-mono whitespace-pre-wrap rounded-md bg-muted p-4">
                        {chunk.text}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
        <div className="mt-4 flex justify-end space-x-2">
          <Button
            variant="secondary"
            onClick={() => {
              // TODO: Add settings dialog for chunk configuration
            }}
          >
            Configure Chunking
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}