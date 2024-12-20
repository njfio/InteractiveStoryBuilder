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
  const { user, loading, initialized, initialize } = useAuthStore();
  const [activeChunk, setActiveChunk] = useState<Chunk | null>(null);
  const manuscriptId = params?.id ? parseInt(params.id) : NaN;

  // Initialize auth state
  useEffect(() => {
    const init = async () => {
      const cleanup = await initialize();
      return cleanup;
    };

    const cleanup = init();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [initialize]);

  // Query manuscript data
  const { data: manuscript, isLoading: isLoadingManuscript } = useQuery<Manuscript>({
    queryKey: [`/api/manuscripts/${manuscriptId}`],
    enabled: !isNaN(manuscriptId) && initialized && !loading && !!user,
  });

  // Query chunks data
  const { data: chunks = [], isLoading: isLoadingChunks } = useQuery<Chunk[]>({
    queryKey: [`/api/manuscripts/${manuscriptId}/chunks`],
    enabled: !isNaN(manuscriptId) && !!manuscript && initialized && !loading && !!user,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (initialized && !loading && !user) {
      setLocation('/login');
    }
  }, [initialized, loading, user, setLocation]);

  // Sync active chunk with URL
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
    } else {
      // Set first chunk as default
      setLocation(`/reader/${manuscriptId}?chunk=${chunks[0].id}`, { replace: true });
      setActiveChunk(chunks[0]);
    }
  }, [chunks, manuscriptId, setLocation, activeChunk]);

  // Show loading state
  if (!initialized || loading || isLoadingManuscript || isLoadingChunks) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Handle unauthorized access
  if (!user) {
    return null;
  }

  // Handle missing manuscript or chunks
  if (!manuscript || !chunks.length) {
    setLocation('/');
    return null;
  }

  // Use active chunk or default to first chunk
  const currentChunk = activeChunk || chunks[0];
  const isAuthor = user?.id === manuscript.authorId;

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
            <ExportDialog manuscriptId={manuscript.id} title={manuscript.title} />
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