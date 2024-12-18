import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { ChunkView } from '@/components/manuscript/ChunkView';
import { useAuthStore } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export function Reader() {
  const [, params] = useRoute('/reader/:id');
  const [location, setLocation] = useLocation();
  const { user } = useAuthStore();
  const [currentChunkId, setCurrentChunkId] = useState<number | null>(null);

  const { data: manuscript, isLoading: isLoadingManuscript } = useQuery<{
    id: number;
    title: string;
    authorId: string;
    author?: { email: string };
  }>({
    queryKey: [`/api/manuscripts/${params?.id}`],
    enabled: !!params?.id,
  });

  const { data: chunks = [], isLoading: isLoadingChunks } = useQuery<Array<{
    id: number;
    manuscriptId: number;
    headingH1?: string;
    headingH2?: string;
    text: string;
    imageUrl?: string;
  }>>({
    queryKey: [`/api/manuscripts/${params?.id}/chunks`],
    enabled: !!params?.id,
  });

  // Handle URL changes and initial load
  useEffect(() => {
    const searchParams = new URLSearchParams(location.split('?')[1]);
    const chunkId = searchParams.get('chunk');
    
    if (chunkId) {
      const parsedId = parseInt(chunkId);
      if (parsedId !== currentChunkId) {
        setCurrentChunkId(parsedId);
      }
    } else if (chunks.length > 0 && !isLoadingChunks) {
      // If no chunk specified, redirect to the first chunk
      setLocation(`/reader/${params?.id}?chunk=${chunks[0].id}`);
    }
  }, [location, chunks, isLoadingChunks, params?.id, currentChunkId]);

  const currentChunk = currentChunkId 
    ? chunks.find(chunk => chunk.id === currentChunkId)
    : chunks[0];

  if (isLoadingManuscript || isLoadingChunks) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!manuscript || !chunks.length) {
    setLocation('/');
    return null;
  }

  const isAuthor = user?.id === manuscript.authorId;

  const handleChunkChange = (chunkId: number) => {
    if (chunkId !== currentChunkId) {
      setLocation(`/reader/${params?.id}?chunk=${chunkId}`);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-2">{manuscript.title}</h1>
          <p className="text-muted-foreground">
            by {manuscript.author?.email || 'Anonymous'}
          </p>
        </header>

        {currentChunk && (
          <ChunkView
            chunk={currentChunk}
            isAuthor={isAuthor}
            onChunkChange={handleChunkChange}
            allChunks={chunks}
          />
        )}
      </div>
    </div>
  );
}
