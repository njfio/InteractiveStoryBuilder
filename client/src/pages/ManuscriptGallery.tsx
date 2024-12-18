import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ImageGallery } from '@/components/manuscript/ImageGallery';
import { Loader2 } from 'lucide-react';

export function ManuscriptGallery() {
  const { id } = useParams<{ id: string }>();
  const manuscriptId = parseInt(id);

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

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-2">
        {manuscript?.title} - Image Gallery
      </h1>
      <ImageGallery manuscriptId={manuscriptId} />
    </div>
  );
}
