import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export function Home() {
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
            <Link href="/reader">Browse Stories</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
