import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface NavigationProps {
  chunks: Array<{
    id: number;
    headingH1?: string;
    headingH2?: string;
  }>;
  currentChunk: number;
  onNavigate: (chunkId: number) => void;
}

export function Navigation({ chunks, currentChunk, onNavigate }: NavigationProps) {
  const currentIndex = chunks.findIndex((chunk) => chunk.id === currentChunk);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < chunks.length - 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Chapters</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
              <div className="space-y-4">
                {chunks.map((chunk) => (
                  <Button
                    key={chunk.id}
                    variant={chunk.id === currentChunk ? 'default' : 'ghost'}
                    className="w-full justify-start text-left"
                    onClick={() => onNavigate(chunk.id)}
                  >
                    <span className="block truncate">
                      {chunk.headingH1 
                        ? chunk.headingH1
                            .replace(/\*\*/g, '')  // Remove all ** markers
                            .replace(/^#+\s*/, '') // Remove any # markers
                            .substring(0, 40)      // Limit length
                        : `Page ${chunk.id}`}
                      {chunk.headingH1 && chunk.headingH1.length > 40 ? '...' : ''}
                    </span>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => canGoPrevious && onNavigate(chunks[currentIndex - 1].id)}
            disabled={!canGoPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => canGoNext && onNavigate(chunks[currentIndex + 1].id)}
            disabled={!canGoNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
