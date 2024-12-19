import { useState } from 'react';
import { Link } from 'wouter';
import { ChapterSelect } from './ChapterSelect';
import { ImageGenerator } from './ImageGenerator';
import { ManuscriptImageSettings } from './ManuscriptImageSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Share2, 
  Settings2,
  Loader2, 
  Images, 
  ChevronLeft, 
  ChevronRight, 
  Home,
  BookOpen
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

interface ImageSettings {
  seed: number;
  prompt: string;
  aspect_ratio: string;
  image_reference_url: string | null;
  style_reference_url: string | null;
  image_reference_weight: number;
  style_reference_weight: number;
}

interface Manuscript {
  id: number;
  title: string;
  authorId: string;
  imageSettings: ImageSettings;
}

interface Chunk {
  id: number;
  manuscriptId: number;
  headingH1?: string;
  headingH2?: string;
  text: string;
  imageUrl?: string;
  manuscript: Manuscript;
}

interface ChunkViewProps {
  chunk: Chunk;
  isAuthor: boolean;
  onChunkChange: (chunkId: number) => void;
  allChunks: Chunk[];
}

export function ChunkView({ chunk, isAuthor, onChunkChange, allChunks }: ChunkViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [chapterSelectOpen, setChapterSelectOpen] = useState(false);
  const { toast } = useToast();
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const queryClient = useQueryClient();
  const currentChunkIndex = allChunks.findIndex(c => c.id === chunk.id);

  const handlePreviousPage = () => {
    if (currentChunkIndex > 0) {
      onChunkChange(allChunks[currentChunkIndex - 1].id);
    }
  };

  const handleNextPage = () => {
    if (currentChunkIndex < allChunks.length - 1) {
      onChunkChange(allChunks[currentChunkIndex + 1].id);
    }
  };

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

  const handleShareChunk = async () => {
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
    <Card className="max-w-4xl mx-auto mb-24">
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
            />
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg py-4 px-6 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="w-1/3 flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setChapterSelectOpen(true)}
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Chapter Select</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/dashboard">
                      <Button variant="ghost" size="icon">
                        <Home className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Back to Dashboard</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={playTTS}
                      disabled={isPlaying}
                    >
                      <Play className={isPlaying ? 'text-primary' : ''} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Play Text-to-Speech</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleShareChunk}>
                      <Share2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Share this section</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="w-1/3 flex items-center justify-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={handlePreviousPage}
                      disabled={currentChunkIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Previous Page</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <span className="text-sm text-muted-foreground">
                Page {currentChunkIndex + 1} of {allChunks.length}
              </span>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handleNextPage}
                      disabled={currentChunkIndex === allChunks.length - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Next Page</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="w-1/3 flex items-center justify-end gap-2">
              {isAuthor && (
                <TooltipProvider>
                  <Dialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Image Generation Settings</p>
                      </TooltipContent>
                    </Tooltip>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Image Generation</DialogTitle>
                        <DialogDescription>
                          Customize and generate images for this section of your manuscript
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
                          currentSettings={{
                            seed: chunk.manuscript?.imageSettings?.seed ?? 469,
                            prompt: chunk.manuscript?.imageSettings?.prompt ?? "",
                            aspect_ratio: chunk.manuscript?.imageSettings?.aspect_ratio ?? "9:16",
                            image_reference_url: chunk.manuscript?.imageSettings?.image_reference_url ?? "",
                            style_reference_url: chunk.manuscript?.imageSettings?.style_reference_url ?? "",
                            image_reference_weight: chunk.manuscript?.imageSettings?.image_reference_weight ?? 0.85,
                            style_reference_weight: chunk.manuscript?.imageSettings?.style_reference_weight ?? 0.85
                          }} 
                        />
                      </div>
                    </DialogContent>
                  </Dialog>
                </TooltipProvider>
              )}
              
              {isAuthor && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Generate New Image</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={`/manuscripts/${chunk.manuscriptId}/gallery`}>
                      <Button variant="ghost" size="icon">
                        <Images className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Image Gallery</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <ChapterSelect
          chunks={allChunks}
          currentChunkId={chunk.id}
          onChunkSelect={onChunkChange}
          open={chapterSelectOpen}
          onOpenChange={setChapterSelectOpen}
        />
      </CardContent>
    </Card>
  );
}
