import type { Express, Request } from 'express';
import { createServer, type Server } from 'http';
import { db } from '@db';
import { manuscripts, chunks, images, seoMetadata, users } from '@db/schema';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);
import { requireAuth } from './middleware/auth';
import { eq, sql } from 'drizzle-orm';
import { parseMarkdown } from '../client/src/lib/markdown';
import { generateImage } from './utils/image';

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
        manuscript: true,
      },
      orderBy: (chunks, { asc }) => [asc(chunks.chunkOrder)],
    });

    // Add image URLs to the response
    const chunksWithImages = results.map(chunk => ({
      ...chunk,
      imageUrl: chunk.images?.[0]?.localPath
    }));

    res.json(chunksWithImages);
  });

  // Manuscript Settings
  app.put('/api/manuscripts/:id/settings', requireAuth, async (req, res) => {
    const { imageSettings } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const manuscript = await db.query.manuscripts.findFirst({
      where: eq(manuscripts.id, parseInt(req.params.id)),
    });

    if (!manuscript) {
      return res.status(404).json({ message: 'Manuscript not found' });
    }

    if (manuscript.authorId !== user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const [updated] = await db
      .update(manuscripts)
      .set({ 
        imageSettings,
        updatedAt: new Date()
      })
      .where(eq(manuscripts.id, manuscript.id))
      .returning();

    res.json(updated);
  });

  // Image Generation
  app.post('/api/generate-image', async (req, res) => {
    const { chunkId, prompt } = req.body;
    
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'No authorization header' });
      }

      const token = authHeader.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Invalid token' });
      }

      const chunk = await db.query.chunks.findFirst({
        where: eq(chunks.id, chunkId),
        with: {
          manuscript: true,
        },
      });

      if (!chunk) {
        return res.status(404).json({ message: 'Chunk not found' });
      }

      if (chunk.manuscript.authorId !== user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      console.log(`Generating image for chunk ${chunkId} with prompt: ${prompt}`);

      // Delete any existing images for this chunk
      await db.delete(images).where(eq(images.chunkId, chunkId));

      // Get the manuscript with its settings
      const manuscript = await db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, chunk.manuscriptId),
        columns: {
          id: true,
          imageSettings: true,
          authorId: true,
        },
      });

      console.log('Using manuscript settings:', manuscript?.imageSettings);

      const imageUrl = await generateImage(
        prompt || chunk.text,
        manuscript?.imageSettings as any || {},
        req.body.characterReferenceUrl
      );

      console.log('Creating image record in database');
      const [image] = await db.insert(images).values({
        manuscriptId: chunk.manuscriptId,
        chunkId: chunk.id,
        localPath: imageUrl,
        promptParams: { prompt },
      }).returning();

      console.log('Image generated successfully:', image.id);
      res.json({ ...image, imageUrl });
    } catch (error) {
      console.error('Error generating image:', error);
      res.status(500).json({ message: 'Failed to generate image' });
    }
  });

  // Image Galleries
  app.get('/api/images', async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const offset = (page - 1) * limit;

    const results = await db.query.images.findMany({
      with: {
        chunk: {
          columns: {
            id: true,
            headingH1: true,
            text: true,
          }
        },
        manuscript: {
          columns: {
            id: true,
            title: true,
            authorId: true,
          }
        }
      },
      orderBy: (images, { desc }) => [desc(images.createdAt)],
      limit,
      offset,
    });

    const total = await db.select({ count: sql<number>`count(*)` }).from(images);

    res.json({
      images: results,
      pagination: {
        page,
        limit,
        total: total[0].count,
        totalPages: Math.ceil(total[0].count / limit)
      }
    });
  });

  app.get('/api/manuscripts/:id/images', async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const offset = (page - 1) * limit;

    const results = await db.query.images.findMany({
      where: eq(images.manuscriptId, parseInt(req.params.id)),
      with: {
        chunk: {
          columns: {
            id: true,
            headingH1: true,
            text: true,
          }
        }
      },
      orderBy: (images, { desc }) => [desc(images.createdAt)],
      limit,
      offset,
    });

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(images)
      .where(eq(images.manuscriptId, parseInt(req.params.id)));

    res.json({
      images: results,
      pagination: {
        page,
        limit,
        total: total[0].count,
        totalPages: Math.ceil(total[0].count / limit)
      }
    });
  });

  // Delete Image
  app.delete('/api/images/:id', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'No authorization header' });
      }

      const token = authHeader.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Invalid token' });
      }

      const image = await db.query.images.findFirst({
        where: eq(images.id, parseInt(req.params.id)),
        with: {
          manuscript: true,
        },
      });

      if (!image) {
        return res.status(404).json({ message: 'Image not found' });
      }

      if (image.manuscript.authorId !== user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      await db.delete(images).where(eq(images.id, image.id));
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({ message: 'Failed to delete image' });
    }
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
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ message: 'OpenAI API key not configured' });
    }

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: "alloy"
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API error:', error);
        return res.status(response.status).json({ message: 'Failed to generate speech' });
      }

      const audioBuffer = await response.arrayBuffer();
      res.set('Content-Type', 'audio/mpeg');
      res.send(Buffer.from(audioBuffer));
    } catch (error) {
      console.error('TTS error:', error);
      res.status(500).json({ message: 'Failed to generate speech' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
