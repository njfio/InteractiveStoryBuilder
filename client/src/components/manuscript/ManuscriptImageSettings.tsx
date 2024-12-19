import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const imageSettingsSchema = z.object({
  seed: z.number().int().positive(),
  prompt: z.string().min(1, "Prompt is required"),
  aspect_ratio: z.string().default("9:16"),
  image_reference_url: z.string().url().optional().or(z.literal("")),
  style_reference_url: z.string().url().optional().or(z.literal("")),
  image_reference_weight: z.number().min(0).max(1).default(0.85),
  style_reference_weight: z.number().min(0).max(1).default(0.85),
});

type ImageSettings = z.infer<typeof imageSettingsSchema>;

interface ManuscriptImageSettingsProps {
  manuscriptId: number;
  currentSettings: ImageSettings;
}

export function ManuscriptImageSettings({ manuscriptId, currentSettings }: ManuscriptImageSettingsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ImageSettings>({
    resolver: zodResolver(imageSettingsSchema),
    defaultValues: {
      seed: currentSettings.seed,
      prompt: currentSettings.prompt,
      aspect_ratio: currentSettings.aspect_ratio,
      image_reference_url: currentSettings.image_reference_url || "",
      style_reference_url: currentSettings.style_reference_url || "",
      image_reference_weight: currentSettings.image_reference_weight,
      style_reference_weight: currentSettings.style_reference_weight,
    },
  });

  const onSubmit = async (values: ImageSettings) => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/manuscripts/${manuscriptId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ imageSettings: values }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      toast({
        title: 'Success',
        description: 'Image settings updated successfully',
      });

      // Update cache immediately and trigger refetch
      queryClient.setQueryData(
        [`/api/manuscripts/${manuscriptId}`],
        (old: any) => ({
          ...old,
          imageSettings: values,
        })
      );

      // Force immediate refetch of chunks to update images
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/manuscripts/${manuscriptId}/chunks`],
        refetchType: 'active',
        exact: true
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Generation Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Prompt</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter base prompt for all images..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="seed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seed</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aspect_ratio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aspect Ratio</FormLabel>
                  <FormControl>
                    <Input placeholder="9:16" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image_reference_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image Reference URL</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image_reference_weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image Reference Weight</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="style_reference_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Style Reference URL</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="style_reference_weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Style Reference Weight</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
