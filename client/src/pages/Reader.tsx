import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { ChunkView } from '@/components/manuscript/ChunkView';
import { useAuthStore } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { ExportDialog } from '@/components/manuscript/ExportDialog';

interface Chunk {
  id: number;
  manuscriptId: number;
  headingH1?: string;
  text: string;
  chunkOrder: number;
  imageUrl?: string;
  manuscript: {
    id: number;
    title: string;
    authorId: string;
    imageSettings: {
      seed: number;
      prompt: string;
      aspect_ratio: string;
      image_reference_url: string | null;
      style_reference_url: string | null;
      image_reference_weight: number;
      style_reference_weight: number;
    };
  };
}

interface Manuscript {
  id: number;
  title: string;
  authorId: string;
  author?: {
    email: string;
    displayName?: string;
  };
}

export function Reader() {
  const [, params] = useRoute('/reader/:id');
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuthStore();
  const [activeChunk, setActiveChunk] = useState<Chunk | null>(null);
  const manuscriptId = params?.id ? parseInt(params.id) : NaN;

  // Handle authentication
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [authLoading, user, setLocation]);

  // If not authenticated or still loading auth, show nothing
  if (authLoading || !user) {
    return null;
  }

  // Query manuscript data
  const { data: manuscript, isLoading: isLoadingManuscript } = useQuery<Manuscript>({
    queryKey: [`/api/manuscripts/${manuscriptId}`],
    enabled: !isNaN(manuscriptId),
  });

  // Query chunks data
  const { data: chunks = [], isLoading: isLoadingChunks } = useQuery<Chunk[]>({
    queryKey: [`/api/manuscripts/${manuscriptId}/chunks`],
    enabled: !isNaN(manuscriptId) && !!manuscript,
  });

  // Handle chunk navigation
  useEffect(() => {
    if (!chunks.length) return;

    const searchParams = new URLSearchParams(window.location.search);
    const chunkId = searchParams.get('chunk');

    if (chunkId) {
      const parsedId = parseInt(chunkId);
      const chunk = chunks.find(c => c.id === parsedId);
      if (chunk && chunk !== activeChunk) {
        setActiveChunk(chunk);
      }
    } else if (chunks[0] && !activeChunk) {
      // Only set first chunk if no active chunk exists
      setLocation(`/reader/${manuscriptId}?chunk=${chunks[0].id}`, { replace: true });
      setActiveChunk(chunks[0]);
    }
  }, [chunks, manuscriptId, setLocation, activeChunk]);

  // Show loading state
  if (isLoadingManuscript || isLoadingChunks) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Handle missing manuscript or chunks after loading
  if (!manuscript || !chunks.length) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Manuscript Not Found</h2>
          <p className="text-muted-foreground">This manuscript may have been deleted or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  // Use active chunk or default to first chunk
  const currentChunk = activeChunk || chunks[0];
  const isAuthor = user.id === manuscript.authorId;

  const handleChunkChange = (chunkId: number) => {
    const newChunk = chunks.find(c => c.id === chunkId);
    if (newChunk && newChunk !== activeChunk) {
      setActiveChunk(newChunk);
      setLocation(`/reader/${manuscriptId}?chunk=${chunkId}`, { replace: true });
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-12 text-center">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold">{manuscript.title}</h1>
            {isAuthor && <ExportDialog manuscriptId={manuscript.id} title={manuscript.title} />}
          </div>
          <p className="text-muted-foreground">
            by {manuscript.author?.displayName || manuscript.author?.email || 'Anonymous'}
          </p>
        </header>

        <ChunkView
          chunk={currentChunk}
          isAuthor={isAuthor}
          onChunkChange={handleChunkChange}
          allChunks={chunks}
        />
      </div>
    </div>
  );
}