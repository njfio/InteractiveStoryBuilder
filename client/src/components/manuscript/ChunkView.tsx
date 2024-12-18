import { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageGenerator } from './ImageGenerator';
import { ManuscriptImageSettings } from './ManuscriptImageSettings';
import { Play, Share2, Settings2, Loader2, Images, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ChunkViewProps {
  chunk: {
    id: number;
    manuscriptId: number;
    headingH1?: string;
    headingH2?: string;
    text: string;
    imageUrl?: string;
    manuscript?: {
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
  };
  isAuthor: boolean;
}

export function ChunkView({ chunk, isAuthor }: ChunkViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const queryClient = useQueryClient();

  const generateImage = useMutation({
    mutationFn: async (chunkData: { chunkId: number; prompt: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to generate images');
      }

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        credentials: 'include',
        body: JSON.stringify(chunkData),
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to generate images');
        }
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate image');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Image generated successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/manuscripts/${chunk.manuscriptId}/chunks`] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate image',
        variant: 'destructive',
      });
    },
  });

  const playTTS = async () => {
    try {
      setIsPlaying(true);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chunk.text }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate audio');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audio) {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      }

      const newAudio = new Audio(audioUrl);
      newAudio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      newAudio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
        toast({
          title: 'Error',
          description: 'Failed to play audio',
          variant: 'destructive',
        });
      };
      setAudio(newAudio);
      await newAudio.play();
    } catch (error) {
      setIsPlaying(false);
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to generate audio',
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
          <div className="relative w-full aspect-[9/16] rounded-lg overflow-hidden bg-muted">
            <img
              src={window.location.origin + chunk.imageUrl}
              alt="Generated illustration"
              className="object-contain w-full h-full"
              onError={(e) => {
                console.error('Error loading image:', e);
                const fallbackSVG = `
                  <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="#f0f0f0"/>
                    <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#666" text-anchor="middle">
                      Image loading failed
                    </text>
                  </svg>
                `;
                e.currentTarget.src = `data:image/svg+xml;base64,${btoa(fallbackSVG)}`;
              }}
            />
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t pt-4">
          <div className="w-1/3 flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={playTTS}
              disabled={isPlaying}
            >
              <Play className={isPlaying ? 'text-primary' : ''} />
            </Button>
            <Button variant="ghost" size="icon" onClick={shareChunk}>
              <Share2 />
            </Button>
            {isAuthor && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Image Generation</DialogTitle>
                    <DialogDescription>
                      Generate and configure images for this section
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6">
                    <ImageGenerator 
                      key={`generator-${chunk.manuscriptId}-${chunk.manuscript?.imageSettings?.seed}`}
                      chunkId={chunk.id} 
                      manuscriptId={chunk.manuscriptId} 
                    />
                    <ManuscriptImageSettings 
                      manuscriptId={chunk.manuscriptId} 
                      currentSettings={chunk.manuscript?.imageSettings || {
                        seed: 469,
                        prompt: "",
                        aspect_ratio: "9:16",
                        image_reference_url: null,
                        style_reference_url: null,
                        image_reference_weight: 0.85,
                        style_reference_weight: 0.85
                      }} 
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="w-1/3 flex items-center justify-center gap-4">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page 1 of 10</span>
            <Button variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-1/3 flex items-center justify-end gap-2">
            {isAuthor && (
              <Button
                variant="ghost"
                onClick={() => {
                  generateImage.mutate({ 
                    chunkId: chunk.id,
                    prompt: chunk.text 
                  });
                }}
                disabled={generateImage.isPending}
                size="sm"
              >
                {generateImage.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Image'
                )}
              </Button>
            )}
            <Link href={`/manuscripts/${chunk.manuscriptId}/gallery`}>
              <Button variant="ghost" size="icon">
                <Images className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
