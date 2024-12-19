import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { saveAs } from 'file-saver';
import { useToast } from '@/hooks/use-toast';

interface ExportDialogProps {
  manuscriptId: number;
  title: string;
}

type ExportFormat = 'epub' | 'markdown' | 'docx';

export function ExportDialog({ manuscriptId, title }: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: ExportFormat) => {
    try {
      setIsExporting(true);
      const response = await fetch(`/api/manuscripts/${manuscriptId}/export?format=${format}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to export manuscript');
      }

      const blob = await response.blob();
      const extension = format === 'markdown' ? 'md' : format;
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
      saveAs(blob, `${sanitizedTitle}.${extension}`);

      toast({
        title: 'Success',
        description: 'Manuscript exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Manuscript</DialogTitle>
          <DialogDescription>
            Choose a format to export your manuscript
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Button
            onClick={() => handleExport('epub')}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'EPUB Format'
            )}
          </Button>
          <Button
            onClick={() => handleExport('markdown')}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Markdown Format'
            )}
          </Button>
          <Button
            onClick={() => handleExport('docx')}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              'Word Document'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
