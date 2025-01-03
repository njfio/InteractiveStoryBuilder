import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Download } from 'lucide-react';

interface ManuscriptSettingsProps {
  manuscript: {
    id: number;
    title: string;
    authorName?: string;
    isPublic?: boolean;
  };
}

export function ManuscriptSettings({ manuscript }: ManuscriptSettingsProps) {
  const [title, setTitle] = useState(manuscript.title);
  const [authorName, setAuthorName] = useState(manuscript.authorName || '');
  const [isPublic, setIsPublic] = useState(manuscript.isPublic || false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateSettings = useMutation({
    mutationFn: async (settings: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/manuscripts/${manuscript.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to update manuscript settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/manuscripts/${manuscript.id}`] });
      toast({
        title: 'Success',
        description: 'Manuscript settings updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDownloadImages = async () => {
    try {
      setIsDownloading(true);
      setDownloadProgress({ current: 0, total: 0 });

      // Start with chunk 0
      let currentChunk = 0;
      let totalChunks = 1;
      let hasMore = true;

      while (hasMore) {
        toast({
          title: 'Downloading',
          description: `Preparing part ${currentChunk + 1}...`,
        });

        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
          `/api/manuscripts/${manuscript.id}/download-images?chunk=${currentChunk}`,
          {
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            }
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to download images');
        }

        // Get total chunks from headers
        totalChunks = parseInt(response.headers.get('X-Total-Chunks') || '1');
        setDownloadProgress({ current: currentChunk + 1, total: totalChunks });

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers.get('Content-Disposition')?.split('filename=')[1].replace(/"/g, '') || 
                    `${manuscript.title.replace(/[^a-zA-Z0-9]/g, '_')}_images_part${currentChunk + 1}of${totalChunks}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Check if we need to continue
        currentChunk++;
        hasMore = currentChunk < totalChunks;

        // Add a small delay between downloads
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: 'Success',
        description: `Downloaded all ${totalChunks} parts successfully`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({ title, authorName, isPublic });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manuscript Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="authorName">Author Name</Label>
            <Input
              id="authorName"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Display name for the author"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
            <Label htmlFor="isPublic">Make manuscript public</Label>
          </div>

          {downloadProgress.total > 0 && (
            <div className="space-y-2">
              <Progress value={(downloadProgress.current / downloadProgress.total) * 100} />
              <p className="text-sm text-muted-foreground">
                Downloading part {downloadProgress.current} of {downloadProgress.total}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="flex-1"
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadImages}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloading ? 'Downloading...' : 'Download Images'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}