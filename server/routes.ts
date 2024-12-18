import type { Express, Request } from 'express';
import { createServer, type Server } from 'http';
import { db } from '@db';
import { manuscripts, chunks, images, seoMetadata, users } from '@db/schema';
import { requireAuth } from './middleware/auth';
import { eq } from 'drizzle-orm';
import { parseMarkdown } from '../client/src/lib/markdown';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      }
    }
  }
}

export function registerRoutes(app: Express): Server {
  // Manuscripts
  app.get('/api/manuscripts', async (req, res) => {
    const results = await db.query.manuscripts.findMany({
      with: {
        author: true,
      },
    });
    res.json(results);
  });

  app.get('/api/manuscripts/:id', async (req, res) => {
    const result = await db.query.manuscripts.findFirst({
      where: eq(manuscripts.id, parseInt(req.params.id)),
      with: {
        author: true,
      },
    });
    if (!result) return res.status(404).send('Manuscript not found');
    res.json(result);
  });

  app.post('/api/manuscripts', requireAuth, async (req, res) => {
    const { title, markdown } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Ensure user exists in our database
    await db.insert(users).values({
      id: user.id,
      email: user.email,
    }).onConflictDoNothing();

    const parsedChunks = await parseMarkdown(markdown);

    const [manuscript] = await db.insert(manuscripts).values({
      title,
      authorId: user.id,
      originalMarkdown: markdown,
    }).returning();

    await db.insert(chunks).values(
      parsedChunks.map(chunk => ({
        manuscriptId: manuscript.id,
        chunkOrder: chunk.order,
        headingH1: chunk.headingH1,
        headingH2: chunk.headingH2,
        text: chunk.text,
      }))
    );

    res.json(manuscript);
  });

  app.delete('/api/manuscripts/:id', async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).send('Unauthorized');

    const manuscript = await db.query.manuscripts.findFirst({
      where: eq(manuscripts.id, parseInt(req.params.id)),
    });

    if (!manuscript) return res.status(404).send('Manuscript not found');
    if (manuscript.authorId !== user.id) return res.status(403).send('Forbidden');

    await db.delete(manuscripts).where(eq(manuscripts.id, manuscript.id));
    res.status(204).end();
  });

  // Chunks
  app.get('/api/manuscripts/:id/chunks', async (req, res) => {
    const results = await db.query.chunks.findMany({
      where: eq(chunks.manuscriptId, parseInt(req.params.id)),
      with: {
        images: true,
      },
      orderBy: (chunks, { asc }) => [asc(chunks.chunkOrder)],
    });
    res.json(results);
  });

  // Image Generation
  app.post('/api/generate-image', async (req, res) => {
    const { chunkId, prompt } = req.body;
    const user = req.user as any;
    if (!user) return res.status(401).send('Unauthorized');

    const chunk = await db.query.chunks.findFirst({
      where: eq(chunks.id, chunkId),
      with: {
        manuscript: true,
      },
    });

    if (!chunk) return res.status(404).send('Chunk not found');
    if (chunk.manuscript.authorId !== user.id) return res.status(403).send('Forbidden');

    // TODO: Implement actual image generation with Replicate API
    // For now, just create a placeholder image record
    const [image] = await db.insert(images).values({
      manuscriptId: chunk.manuscriptId,
      chunkId: chunk.id,
      localPath: '/placeholder.jpg',
      promptParams: { prompt },
    }).returning();

    res.json(image);
  });

  // Bulk Image Generation
  app.post('/api/manuscripts/:id/generate-images', async (req, res) => {
    const user = req.user as any;
    if (!user) return res.status(401).send('Unauthorized');

    const manuscript = await db.query.manuscripts.findFirst({
      where: eq(manuscripts.id, parseInt(req.params.id)),
    });

    if (!manuscript) return res.status(404).send('Manuscript not found');
    if (manuscript.authorId !== user.id) return res.status(403).send('Forbidden');

    // TODO: Implement bulk image generation
    res.status(202).json({ message: 'Image generation started' });
  });

  // Text-to-Speech
  app.post('/api/tts', async (req, res) => {
    const { text } = req.body;
    // TODO: Implement actual TTS with Gemini API
    res.status(501).send('Not implemented');
  });

  const httpServer = createServer(app);
  return httpServer;
}
