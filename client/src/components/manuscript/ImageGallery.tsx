import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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
import { Loader2, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageGalleryProps {
  manuscriptId?: number;
}

export function ImageGallery({ manuscriptId }: ImageGalleryProps) {
  const [page, setPage] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const limit = 12;

  const { data, isLoading } = useQuery({
    queryKey: manuscriptId 
      ? [`/api/manuscripts/${manuscriptId}/images`, page]
      : ['/api/images', page],
    queryFn: async () => {
      const url = manuscriptId
        ? `/api/manuscripts/${manuscriptId}/images?page=${page}&limit=${limit}`
        : `/api/images?page=${page}&limit=${limit}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch images');
      return response.json();
    }
  });

  const deleteImage = useMutation({
    mutationFn: async (imageId: number) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in to delete images');

      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete image');
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Image deleted successfully',
      });
      queryClient.invalidateQueries({ 
        queryKey: manuscriptId 
          ? [`/api/manuscripts/${manuscriptId}/images`]
          : ['/api/images']
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const regenerateImage = useMutation({
    mutationFn: async ({ chunkId, prompt }: { chunkId: number, prompt: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in to regenerate images');

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ chunkId, prompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to regenerate image');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Image regenerated successfully',
      });
      queryClient.invalidateQueries({ 
        queryKey: manuscriptId 
          ? [`/api/manuscripts/${manuscriptId}/images`]
          : ['/api/images']
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {data?.images.map((image: any) => (
          <Card key={image.id} className="overflow-hidden">
            <div 
              className="relative aspect-[9/16] cursor-pointer"
              onClick={() => setLocation(`/reader/${image.manuscriptId}?chunk=${image.chunkId}`)}
            >
              <img
                src={window.location.origin + image.localPath}
                alt={image.chunk.headingH1 || 'Generated illustration'}
                className="object-cover w-full h-full"
              />
            </div>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {image.chunk.text}
              </p>
            </CardContent>
            <CardFooter className="flex justify-between p-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Image</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this image? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteImage.mutate(image.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteImage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Delete'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button 
                variant="outline" 
                size="icon"
                onClick={() => regenerateImage.mutate({
                  chunkId: image.chunkId,
                  prompt: image.chunk.text
                })}
                disabled={regenerateImage.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${
                  regenerateImage.isPending ? 'animate-spin' : ''
                }`} />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => page > 1 && setPage(p => p - 1)}
              />
            </PaginationItem>
            
            {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === data.pagination.totalPages || Math.abs(p - page) <= 1)
              .map((p, i, arr) => {
                if (i > 0 && arr[i - 1] !== p - 1) {
                  return (
                    <PaginationItem key={`ellipsis-${p}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={page === p}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

            <PaginationItem>
              <PaginationNext 
                onClick={() => page < data.pagination.totalPages && setPage(p => p + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
