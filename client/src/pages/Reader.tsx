import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { ChunkView } from '@/components/manuscript/ChunkView';
import { Navigation } from '@/components/manuscript/Navigation';
import { useAuthStore } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export function Reader() {
  const [, params] = useRoute('/reader/:id');
  const [location, setLocation] = useLocation();
  const { user } = useAuthStore();

  // Get chunkId from URL query parameters
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const chunkIdFromUrl = searchParams.get('chunk');
  
  const [currentChunkId, setCurrentChunkId] = useState<number | null>(
    chunkIdFromUrl ? parseInt(chunkIdFromUrl) : null
  );

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
    headingH1?: string;
    headingH2?: string;
    text: string;
    imageUrl?: string;
  }>>({
    queryKey: [`/api/manuscripts/${params?.id}/chunks`],
    enabled: !!params?.id,
  });

  // Effect to update URL when chunk changes
  useEffect(() => {
    if (chunks.length > 0) {
      const targetChunkId = currentChunkId || chunks[0]?.id;
      if (targetChunkId && !chunkIdFromUrl) {
        setLocation(`/reader/${params?.id}?chunk=${targetChunkId}`);
      }
    }
  }, [chunks, currentChunkId, params?.id]);

  // Effect to handle URL chunk parameter changes
  useEffect(() => {
    if (chunkIdFromUrl) {
      const parsedChunkId = parseInt(chunkIdFromUrl);
      if (parsedChunkId !== currentChunkId) {
        setCurrentChunkId(parsedChunkId);
      }
    }
  }, [chunkIdFromUrl]);

  if (isLoadingManuscript || isLoadingChunks) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!manuscript || !chunks) {
    setLocation('/');
    return null;
  }

  const currentChunk = chunks.find(
    (chunk: any) => chunk.id === (currentChunkId || chunks[0]?.id)
  );

  const isAuthor = user?.id === manuscript.authorId;

  const handleChunkChange = (chunkId: number) => {
    setLocation(`/reader/${params?.id}?chunk=${chunkId}`);
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
