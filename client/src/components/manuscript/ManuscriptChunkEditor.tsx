import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreVertical,
  Plus,
  Trash,
  Scissors,
  Merge,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { ChunkEditor } from './ChunkEditor';

interface ManuscriptChunkEditorProps {
  manuscriptId: number;
}

export function ManuscriptChunkEditor({ manuscriptId }: ManuscriptChunkEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);

  // Fetch chunks for this manuscript
  const { data: chunks = [], isLoading } = useQuery({
    queryKey: [`/api/manuscripts/${manuscriptId}/chunks`],
  });

  // Update chunk mutation
  const updateChunk = useMutation({
    mutationFn: async ({ id, text, order }: any) => {
      const response = await fetch(`/api/manuscripts/${manuscriptId}/chunks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, order }),
      });
      if (!response.ok) throw new Error('Failed to update chunk');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/manuscripts/${manuscriptId}/chunks`] });
      toast({ title: 'Success', description: 'Chunk updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Merge chunks mutation
  const mergeChunks = useMutation({
    mutationFn: async ({ chunk1Id, chunk2Id }: any) => {
      const response = await fetch(`/api/manuscripts/${manuscriptId}/chunks/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk1Id, chunk2Id }),
      });
      if (!response.ok) throw new Error('Failed to merge chunks');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/manuscripts/${manuscriptId}/chunks`] });
      toast({ title: 'Success', description: 'Chunks merged successfully' });
    },
  });

  // Split chunk mutation
  const splitChunk = useMutation({
    mutationFn: async ({ id, splitPoint }: any) => {
      const response = await fetch(`/api/manuscripts/${manuscriptId}/chunks/${id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splitPoint }),
      });
      if (!response.ok) throw new Error('Failed to split chunk');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/manuscripts/${manuscriptId}/chunks`] });
      toast({ title: 'Success', description: 'Chunk split successfully' });
    },
  });

  const handleMoveChunk = async (chunk: any, direction: 'up' | 'down') => {
    const currentIndex = chunks.findIndex((c: any) => c.id === chunk.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= chunks.length) return;

    const updates = [
      { id: chunk.id, order: newIndex },
      { id: chunks[newIndex].id, order: currentIndex },
    ];

    await Promise.all(
      updates.map(({ id, order }) => updateChunk.mutateAsync({ id, order }))
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">⌛</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-background p-4 border-b">
        <h2 className="text-2xl font-bold">Manuscript Chunks</h2>
        <p className="text-sm text-muted-foreground">
          Edit, reorder, merge, or split chunks using the controls below
        </p>
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-4 p-4">
          {chunks.map((chunk: any, index: number) => (
            <Card
              key={chunk.id}
              className={`p-4 ${
                selectedChunk === chunk.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveChunk(chunk, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveChunk(chunk, 'down')}
                    disabled={index === chunks.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1">
                  <ChunkEditor
                    chunk={chunk}
                    chunks={chunks}
                    onUpdateChunk={(updatedChunk) =>
                      updateChunk.mutate({
                        id: chunk.id,
                        text: updatedChunk.text,
                        order: updatedChunk.order,
                      })
                    }
                    onMergeChunks={(chunk1, chunk2) =>
                      mergeChunks.mutate({
                        chunk1Id: chunk1.id,
                        chunk2Id: chunk2.id,
                      })
                    }
                    onSplitChunk={(chunk, splitPoint) =>
                      splitChunk.mutate({
                        id: chunk.id,
                        splitPoint,
                      })
                    }
                    onReorderChunk={handleMoveChunk}
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setSelectedChunk(chunk.id)}
                      className="flex items-center"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Insert After
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        mergeChunks.mutate({
                          chunk1Id: chunk.id,
                          chunk2Id: chunks[index + 1]?.id,
                        })
                      }
                      disabled={index === chunks.length - 1}
                      className="flex items-center"
                    >
                      <Merge className="mr-2 h-4 w-4" />
                      Merge with Next
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex items-center text-destructive">
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
