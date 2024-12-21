import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ImageGallery } from '@/components/manuscript/ImageGallery';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth';

export function ManuscriptGallery() {
  const { id } = useParams<{ id: string }>();
  const manuscriptId = parseInt(id);
  const { user } = useAuthStore();

  const { data: manuscript, isLoading } = useQuery({
    queryKey: [`/api/manuscripts/${manuscriptId}`],
    enabled: !isNaN(manuscriptId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isAuthor = user?.id === manuscript?.authorId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {manuscript?.title} - Image Gallery
        </h1>
        <Link href={`/reader/${manuscriptId}`}>
          <Button variant="outline">Back to Manuscript</Button>
        </Link>
      </div>
      <ImageGallery manuscriptId={manuscriptId} isAuthor={isAuthor} />
    </div>
  );
}