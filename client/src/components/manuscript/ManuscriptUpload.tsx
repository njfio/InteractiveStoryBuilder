import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MarkdownEditor } from './MarkdownEditor';
import { ChunkPreview } from './ChunkPreview';
import { EditorView } from '@codemirror/view';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  markdown: z.string().min(1, 'Content is required'),
});

export function ManuscriptUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [currentChunks, setCurrentChunks] = useState<any[]>([]);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      markdown: '',
    },
  });

  const handleChunkSelect = (chunkText: string) => {
    if (editorView) {
      const content = form.getValues('markdown');
      const position = content.indexOf(chunkText);

      if (position !== -1) {
        const beforeText = content.substring(0, position);
        const lines = beforeText.split('\n');
        const line = lines.length - 1;
        const col = lines[lines.length - 1].length;

        const from = editorView.state.doc.line(line + 1).from + col;
        const to = from + chunkText.length;

        editorView.dispatch({
          selection: { anchor: from, head: to },
          effects: EditorView.scrollIntoView(from)
        });
        editorView.focus();
      }
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/manuscripts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to upload manuscript');
      }

      toast({
        title: 'Success',
        description: 'Manuscript uploaded successfully',
      });

      form.reset();
      setCurrentChunks([]);
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog>
      <DialogContent className="w-[90vw] max-w-[1400px] h-[90vh] overflow-y-auto">
        <DialogTitle>Upload Manuscript</DialogTitle>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="My Novel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormField
                control={form.control}
                name="markdown"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content (Markdown)</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <MarkdownEditor
                          value={field.value}
                          onChange={field.onChange}
                          onEditorMount={setEditorView}
                          className="min-h-[330px] max-h-[440px] border rounded-md w-full"
                        />

                        {field.value && (
                          <Card className="w-full">
                            <CardContent className="pt-6">
                              <ChunkPreview 
                                markdown={field.value}
                                onChange={setCurrentChunks}
                                onChunkSelect={handleChunkSelect}
                              />
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="sticky bottom-0 bg-background pt-4">
              <Button type="submit" disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload Manuscript'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}