import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Book } from 'lucide-react';

export function Home() {
  const { data: publicManuscripts, isLoading } = useQuery({
    queryKey: ['/api/manuscripts/public'],
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="max-w-4xl mx-auto px-4 py-24">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
          Share Your Story
        </h1>
        <p className="mt-6 text-xl text-muted-foreground">
          Transform your manuscript into a rich multimedia experience with AI-generated
          illustrations and text-to-speech narration.
        </p>
        <div className="mt-12 space-x-4">
          <Button asChild size="lg">
            <Link href="/login">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">Browse Your Stories</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : publicManuscripts?.length > 0 ? (
          <div className="mt-16">
            <h2 className="text-3xl font-bold mb-8">Featured Stories</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {publicManuscripts.map((manuscript: any) => (
                <Card key={manuscript.id}>
                  <CardHeader>
                    <CardTitle>{manuscript.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      by {manuscript.authorName || 'Anonymous'}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/reader/${manuscript.id}`}>
                        <Book className="mr-2 h-4 w-4" />
                        Read Story
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}