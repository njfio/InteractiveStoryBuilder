import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Edit2, Scissors, MoveUp, MoveDown, Merge } from 'lucide-react';
import { ChunkPreview } from './ChunkPreview';

interface ChunkData {
  headingH1?: string;
  text: string;
  order: number;
}

interface ChunkEditorProps {
  chunk: ChunkData;
  chunks: ChunkData[];
  onUpdateChunk: (updatedChunk: ChunkData) => void;
  onMergeChunks: (chunk1: ChunkData, chunk2: ChunkData) => void;
  onSplitChunk: (chunk: ChunkData, splitPoint: number) => void;
  onReorderChunk: (chunk: ChunkData, direction: 'up' | 'down') => void;
}

export function ChunkEditor({
  chunk,
  chunks,
  onUpdateChunk,
  onMergeChunks,
  onSplitChunk,
  onReorderChunk,
}: ChunkEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(chunk.text);
  const [showSplitPreview, setShowSplitPreview] = useState(false);
  const [splitPoint, setSplitPoint] = useState(0);

  const currentIndex = chunks.findIndex((c) => c.order === chunk.order);
  const canMoveUp = currentIndex > 0;
  const canMoveDown = currentIndex < chunks.length - 1;
  const canMergeDown = currentIndex < chunks.length - 1;

  const handleSave = () => {
    onUpdateChunk({ ...chunk, text: editedText });
    setIsEditing(false);
  };

  const handleMergeDown = () => {
    if (canMergeDown) {
      const nextChunk = chunks[currentIndex + 1];
      onMergeChunks(chunk, nextChunk);
    }
  };

  const handleSplit = () => {
    onSplitChunk(chunk, splitPoint);
    setShowSplitPreview(false);
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{chunk.headingH1 || `Chunk ${chunk.order + 1}`}</span>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Dialog open={showSplitPreview} onOpenChange={setShowSplitPreview}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Scissors className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Split Chunk</DialogTitle>
                  <DialogDescription>
                    Click where you want to split the chunk
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    value={chunk.text}
                    onClick={(e) => {
                      const textarea = e.target as HTMLTextAreaElement;
                      setSplitPoint(textarea.selectionStart);
                    }}
                    readOnly
                    className="min-h-[200px] font-mono"
                  />
                  {splitPoint > 0 && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="mb-2 font-medium">Preview of split:</h4>
                        <div className="space-y-2">
                          <Card>
                            <CardContent className="p-4">
                              <pre className="whitespace-pre-wrap">
                                {chunk.text.slice(0, splitPoint)}
                              </pre>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <pre className="whitespace-pre-wrap">
                                {chunk.text.slice(splitPoint)}
                              </pre>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                      <Button onClick={handleSplit}>Confirm Split</Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            {canMergeDown && (
              <Button variant="ghost" size="sm" onClick={handleMergeDown}>
                <Merge className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={!canMoveUp}
              onClick={() => onReorderChunk(chunk, 'up')}
            >
              <MoveUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canMoveDown}
              onClick={() => onReorderChunk(chunk, 'down')}
            >
              <MoveDown className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-full max-h-[300px]">
          {isEditing ? (
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="min-h-[200px] font-mono"
            />
          ) : (
            <div className="whitespace-pre-wrap font-mono">{chunk.text}</div>
          )}
        </ScrollArea>
      </CardContent>
      {isEditing && (
        <CardFooter className="justify-end space-x-2">
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </CardFooter>
      )}
    </Card>
  );
}
