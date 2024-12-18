import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface ChapterSelectProps {
  chunks: Array<any>;
  currentChunkId: number;
  onChunkSelect: (chunkId: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChapterSelect({
  chunks,
  currentChunkId,
  onChunkSelect,
  open,
  onOpenChange,
}: ChapterSelectProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Chapter Select</DialogTitle>
          <DialogDescription>
            Navigate through the manuscript by selecting a chapter
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-2">
            {chunks.map((chunk, index) => (
              <Button
                key={chunk.id}
                variant={chunk.id === currentChunkId ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  onChunkSelect(chunk.id);
                  onOpenChange(false);
                }}
              >
                <div className="flex justify-between w-full items-center">
                  <span className="truncate">
                    {chunk.headingH1 || `Chapter ${index + 1}`}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {index + 1}/{chunks.length}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
