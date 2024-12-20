import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

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

          <Button
            type="submit"
            disabled={updateSettings.isPending}
            className="w-full"
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
        </form>
      </CardContent>
    </Card>
  );
}
