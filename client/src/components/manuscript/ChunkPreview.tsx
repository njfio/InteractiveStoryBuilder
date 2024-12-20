import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    preserveLists: true,
    minLines: 2,
  });

  useEffect(() => {
    if (!markdown) {
      setChunks([]);
      return;
    }

    const parseContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const parsedChunks = await parseMarkdown(markdown, settings);
        setChunks(parsedChunks);
        onChange?.(parsedChunks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse markdown');
      } finally {
        setLoading(false);
      }
    };

    parseContent();
  }, [markdown, onChange, settings]);

  const toggleAllChunks = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Stop event bubbling
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
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-medium">Content Chunks ({chunks.length})</div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
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

            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                >
                  Configure Chunking
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Chunk Settings</DialogTitle>
                  <DialogDescription>
                    Configure how your content is split into chunks
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Preserve Lists</Label>
                      <div className="text-sm text-muted-foreground">
                        Keep list items together in the same chunk
                      </div>
                    </div>
                    <Switch
                      checked={settings.preserveLists}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({ ...prev, preserveLists: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Minimum Lines</Label>
                      <div className="text-sm text-muted-foreground">
                        Minimum number of lines for a chunk
                      </div>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={settings.minLines}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          minLines: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-20 px-2 py-1 rounded-md border"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
      </CardContent>
    </Card>
  );
}