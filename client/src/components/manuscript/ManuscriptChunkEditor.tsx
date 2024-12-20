import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreVertical,
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

interface Chunk {
  id: number;
  manuscriptId: number;
  headingH1?: string;
  text: string;
  chunkOrder: number;
}

interface ManuscriptChunkEditorProps {
  manuscriptId: number;
  chunk?: Chunk;
}

export function ManuscriptChunkEditor({ manuscriptId, chunk }: ManuscriptChunkEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChunk, setSelectedChunk] = useState<number | null>(chunk?.id || null);

  // Fetch all chunks for this manuscript for proper ordering
  const { data: chunks = [], isLoading } = useQuery<Chunk[]>({
    queryKey: [`/api/manuscripts/${manuscriptId}/chunks`],
  });

  // Update chunk mutation
  const updateChunk = useMutation({
    mutationFn: async ({ id, text, chunkOrder }: Partial<Chunk> & { chunkOrder?: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/manuscripts/${manuscriptId}/chunks/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ text, chunkOrder }),
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
    mutationFn: async ({ chunk1Id, chunk2Id }: { chunk1Id: number; chunk2Id: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/manuscripts/${manuscriptId}/chunks/merge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ chunk1Id, chunk2Id }),
      });
      if (!response.ok) throw new Error('Failed to merge chunks');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/manuscripts/${manuscriptId}/chunks`] });
      toast({ title: 'Success', description: 'Chunks merged successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Split chunk mutation
  const splitChunk = useMutation({
    mutationFn: async ({ id, splitPoint }: { id: number; splitPoint: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/manuscripts/${manuscriptId}/chunks/${id}/split`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ splitPoint }),
      });
      if (!response.ok) throw new Error('Failed to split chunk');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/manuscripts/${manuscriptId}/chunks`] });
      toast({ title: 'Success', description: 'Chunk split successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleMoveChunk = async (chunkToMove: Chunk, direction: 'up' | 'down') => {
    const currentIndex = chunks.findIndex((c) => c.id === chunkToMove.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= chunks.length) return;

    const updates = [
      { id: chunkToMove.id, chunkOrder: chunks[newIndex].chunkOrder },
      { id: chunks[newIndex].id, chunkOrder: chunkToMove.chunkOrder },
    ];

    await Promise.all(
      updates.map(({ id, chunkOrder }) =>
        updateChunk.mutateAsync({ id, chunkOrder })
      )
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">⌛</div>
      </div>
    );
  }

  // Filter chunks to show either all chunks or just the selected one
  const chunksToShow = chunk ? [chunk] : chunks.sort((a, b) => a.chunkOrder - b.chunkOrder);

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-4 p-4">
          {chunksToShow.map((currentChunk, index) => (
            <Card
              key={currentChunk.id}
              className={`p-4 ${
                selectedChunk === currentChunk.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveChunk(currentChunk, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveChunk(currentChunk, 'down')}
                    disabled={index === chunks.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1">
                  <Textarea
                    value={currentChunk.text}
                    onChange={(e) =>
                      updateChunk.mutate({
                        id: currentChunk.id,
                        text: e.target.value,
                        chunkOrder: currentChunk.chunkOrder,
                      })
                    }
                    className="min-h-[100px] font-mono"
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
                      onClick={() =>
                        mergeChunks.mutate({
                          chunk1Id: currentChunk.id,
                          chunk2Id: chunks[index + 1]?.id,
                        })
                      }
                      disabled={index === chunks.length - 1}
                      className="flex items-center"
                    >
                      <Merge className="mr-2 h-4 w-4" />
                      Merge with Next
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const splitPoint = Math.floor(currentChunk.text.length / 2);
                        splitChunk.mutate({
                          id: currentChunk.id,
                          splitPoint,
                        });
                      }}
                      className="flex items-center"
                    >
                      <Scissors className="mr-2 h-4 w-4" />
                      Split in Half
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