import { useState } from 'react';
import { Link } from 'wouter';
import { ChapterSelect } from './ChapterSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Share2, 
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

interface ChunkViewProps {
  chunk: {
    id: number;
    manuscriptId: number;
    headingH1?: string;
    headingH2?: string;
    text: string;
    imageUrl?: string;
  };
  isAuthor: boolean;
  onChunkChange: (chunkId: number) => void;
  allChunks: Array<any>;
}

export function ChunkView({ chunk, isAuthor, onChunkChange, allChunks }: ChunkViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [chapterSelectOpen, setChapterSelectOpen] = useState(false);
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

  const handleShareChunk = async () => {
    try {
      await navigator.share({
        title: chunk.headingH1 || 'Shared Story',
        text: chunk.text,
        url: window.location.href,
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to share:', error);
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
                      onClick={() => setIsPlaying(!isPlaying)}
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