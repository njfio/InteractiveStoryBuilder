import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { ManuscriptUpload } from '@/components/manuscript/ManuscriptUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { requireAuth } from '@/lib/auth';
import { Loader2, Book, Image as ImageIcon, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);

  // Check authentication
  if (!requireAuth()) {
    setLocation('/login');
    return null;
  }

  const { data: manuscripts = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/manuscripts'],
  });

  const deleteManuscript = useMutation({
    mutationFn: async (id: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to delete manuscripts');
      }

      setDeleteLoading(id);

      const response = await fetch(`/api/manuscripts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete manuscript');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manuscripts'] });
      toast({
        title: 'Success',
        description: 'Manuscript deleted successfully',
      });
      setDeleteLoading(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
      setDeleteLoading(null);
    },
  });

  const generateAllImages = useMutation({
    mutationFn: async (manuscriptId: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to generate images');
      }

      const response = await fetch(`/api/manuscripts/${manuscriptId}/generate-images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!response.ok) throw new Error('Failed to generate images');
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Image generation started',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold">Your Manuscripts</h1>
        <Button onClick={() => setShowUpload(true)}>Upload New</Button>
      </div>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Manuscript</DialogTitle>
          </DialogHeader>
          <ManuscriptUpload />
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {manuscripts?.map((manuscript: any) => (
          <Card key={manuscript.id}>
            <CardHeader>
              <CardTitle className="text-xl">{manuscript.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(`/reader/${manuscript.id}`)}
                >
                  <Book className="mr-2 h-4 w-4" />
                  Read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateAllImages.mutate(manuscript.id)}
                  disabled={generateAllImages.isPending}
                >
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Generate Images
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Manuscript</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this manuscript? This action cannot be undone
                        and will also delete all associated chunks and images.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteManuscript.mutate(manuscript.id)}
                        disabled={deleteLoading === manuscript.id}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {deleteLoading === manuscript.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Delete'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}