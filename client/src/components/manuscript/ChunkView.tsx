import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageGenerator } from './ImageGenerator';
import { Play, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChunkViewProps {
  chunk: {
    id: number;
    headingH1?: string;
    headingH2?: string;
    text: string;
    imageUrl?: string;
  };
  isAuthor: boolean;
}

export function ChunkView({ chunk, isAuthor }: ChunkViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const playTTS = async () => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk.text }),
      });

      if (!response.ok) throw new Error('Failed to generate audio');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audio) {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      }

      const newAudio = new Audio(audioUrl);
      newAudio.onended = () => setIsPlaying(false);
      setAudio(newAudio);
      newAudio.play();
      setIsPlaying(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate audio',
        variant: 'destructive',
      });
    }
  };

  const shareChunk = async () => {
    try {
      await navigator.share({
        title: chunk.headingH1 || 'Shared Story',
        text: chunk.text,
        url: window.location.href,
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast({
          title: 'Error',
          description: 'Failed to share',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        {chunk.headingH1 && (
          <CardTitle className="text-3xl font-bold">{chunk.headingH1}</CardTitle>
        )}
        {chunk.headingH2 && (
          <h3 className="text-xl text-gray-600">{chunk.headingH2}</h3>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="prose max-w-none">
          <p className="text-lg leading-relaxed">{chunk.text}</p>
        </div>

        {chunk.imageUrl && (
          <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-muted">
            <img
              src={chunk.imageUrl}
              alt="Generated illustration"
              className="object-contain w-full h-full"
              onError={(e) => {
                console.error('Error loading image:', e);
                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RXJyb3IgbG9hZGluZyBpbWFnZTwvdGV4dD48L3N2Zz4=';
              }}
            />
          </div>
        )}

        {isAuthor && <ImageGenerator chunkId={chunk.id} />}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={playTTS}
            disabled={isPlaying}
          >
            <Play className={isPlaying ? 'text-primary' : ''} />
          </Button>
          <Button variant="outline" size="icon" onClick={shareChunk}>
            <Share2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
