import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageGeneratorProps {
  chunkId: number;
  manuscriptId: number;
}

export function ImageGenerator({ chunkId, manuscriptId }: ImageGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [characterReferenceUrl, setCharacterReferenceUrl] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateImage = async () => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ chunkId, prompt, characterReferenceUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      toast({
        title: 'Success',
        description: 'Image generated successfully',
      });
      
      // Invalidate the chunks query to refresh the UI
      queryClient.invalidateQueries([`/api/manuscripts/${manuscriptId}/chunks`]);
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-2">
          <div className="space-y-2">
            <Input
              placeholder="Custom prompt for image generation..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
            />
            <Input
              placeholder="Character reference URL (optional)"
              value={characterReferenceUrl}
              onChange={(e) => setCharacterReferenceUrl(e.target.value)}
              disabled={isGenerating}
              type="url"
            />
          </div>
          <Button
            onClick={generateImage}
            disabled={isGenerating}
            className="whitespace-nowrap"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Generate Image
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
