import type { Express } from 'express';
import { createServer, type Server } from 'http';
import { db } from '@db';
import { manuscripts, users, chunks } from '@db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from './middleware/auth';
import { createClient } from '@supabase/supabase-js';
import { sql } from 'drizzle-orm';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export function registerRoutes(app: Express): Server {
  // Image Generation Route
  app.post('/api/generate-image', requireAuth, async (req, res) => {
    const { chunkId, prompt } = req.body;

    try {
      const chunk = await db.query.chunks.findFirst({
        where: eq(chunks.id, chunkId),
        with: {
          manuscript: {
            columns: {
              id: true,
              authorId: true,
              imageSettings: true,
            },
          },
        },
      });

      if (!chunk) {
        return res.status(404).json({ message: 'Chunk not found' });
      }

      if (chunk.manuscript.authorId !== req.user?.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      console.log(`Generating image for chunk ${chunkId} with prompt: ${prompt}`);

      // Call Replicate API for image generation
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
          input: {
            prompt: prompt || chunk.text,
            negative_prompt: "blurry, bad anatomy, bad hands, cropped, worst quality",
            num_inference_steps: 50,
            guidance_scale: 7.5,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Replicate API error: ${response.statusText}`);
      }

      const prediction = await response.json();
      console.log('Image generation started:', prediction);

      // Update chunk with image URL
      const [updated] = await db
        .update(chunks)
        .set({ 
          imageUrl: prediction.output?.[0] || null,
          updatedAt: new Date()
        })
        .where(eq(chunks.id, chunkId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error generating image:', error);
      res.status(500).json({ message: 'Failed to generate image' });
    }
  });

  // Manuscripts
  app.get('/api/manuscripts', requireAuth, async (req, res) => {
    try {
      const results = await db.query.manuscripts.findMany({
        with: {
          author: {
            columns: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });
      res.json(results);
    } catch (error) {
      console.error('Error fetching manuscripts:', error);
      res.status(500).json({ message: 'Failed to fetch manuscripts' });
    }
  });

  app.get('/api/manuscripts/:id', requireAuth, async (req, res) => {
    try {
      console.log('Fetching manuscript:', req.params.id, 'for user:', req.user?.id);

      const result = await db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, parseInt(req.params.id)),
        with: {
          author: {
            columns: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });

      if (!result) {
        console.log('Manuscript not found:', req.params.id);
        return res.status(404).json({ message: 'Manuscript not found' });
      }

      console.log('Found manuscript:', result.id, 'authored by:', result.authorId);
      res.json(result);
    } catch (error) {
      console.error('Error fetching manuscript:', error);
      res.status(500).json({ message: 'Failed to fetch manuscript' });
    }
  });

  app.get('/api/manuscripts/:id/chunks', requireAuth, async (req, res) => {
    try {
      const results = await db.query.chunks.findMany({
        where: eq(chunks.manuscriptId, parseInt(req.params.id)),
        orderBy: (chunks, { asc }) => [asc(chunks.chunkOrder)],
        columns: {
          id: true,
          manuscriptId: true,
          headingH1: true,
          text: true,
          chunkOrder: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
        },
        with: {
          manuscript: {
            columns: {
              id: true,
              title: true,
              authorId: true,
              imageSettings: true,
            },
          },
        },
      });

      res.json(results);
    } catch (error) {
      console.error('Error fetching chunks:', error);
      res.status(500).json({ message: 'Failed to fetch chunks' });
    }
  });

  app.post('/api/manuscripts', requireAuth, async (req, res) => {
    const { title, markdown } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
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
        parsedChunks.map((chunk: any) => ({
          manuscriptId: manuscript.id,
          chunkOrder: chunk.order,
          headingH1: chunk.headingH1,
          text: chunk.text,
        }))
      );

      res.json(manuscript);
    } catch (error) {
      console.error('Error creating manuscript:', error);
      res.status(500).json({ message: 'Failed to create manuscript' });
    }
  });

  app.put('/api/manuscripts/:id/title', requireAuth, async (req, res) => {
    try {
      const { title } = req.body;
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
          title,
          updatedAt: new Date()
        })
        .where(eq(manuscripts.id, manuscript.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error updating manuscript title:', error);
      res.status(500).json({ message: 'Failed to update manuscript title' });
    }
  });

  app.put('/api/users/display-name', requireAuth, async (req, res) => {
    try {
      const { displayName } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const [updated] = await db
        .update(users)
        .set({ displayName })
        .where(eq(users.id, user.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error updating display name:', error);
      res.status(500).json({ message: 'Failed to update display name' });
    }
  });

  app.delete('/api/manuscripts/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const manuscript = await db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, parseInt(req.params.id)),
        columns: {
          id: true,
          authorId: true
        }
      });

      if (!manuscript) {
        return res.status(404).json({ message: 'Manuscript not found' });
      }

      if (manuscript.authorId !== user.id) {
        return res.status(403).json({ message: 'Forbidden - you can only delete your own manuscripts' });
      }

      // Delete the manuscript - cascade will handle related records
      await db.delete(manuscripts)
        .where(eq(manuscripts.id, manuscript.id));

      res.status(204).end();
    } catch (error) {
      console.error('Error deleting manuscript:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to delete manuscript' 
      });
    }
  });


  app.put('/api/manuscripts/:manuscriptId/chunks/:id', requireAuth, async (req, res) => {
    try {
      const { text, order } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Verify manuscript ownership
      const manuscript = await db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, parseInt(req.params.manuscriptId)),
      });

      if (!manuscript) {
        return res.status(404).json({ message: 'Manuscript not found' });
      }

      if (manuscript.authorId !== user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Update the chunk
      const [updatedChunk] = await db
        .update(chunks)
        .set({ 
          text,
          chunkOrder: order,
          updatedAt: new Date()
        })
        .where(eq(chunks.id, parseInt(req.params.id)))
        .returning();

      res.json(updatedChunk);
    } catch (error) {
      console.error('Error updating chunk:', error);
      res.status(500).json({ message: 'Failed to update chunk' });
    }
  });

  // Merge chunks
  app.post('/api/manuscripts/:manuscriptId/chunks/merge', requireAuth, async (req, res) => {
    try {
      const { chunk1Id, chunk2Id } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Verify manuscript ownership
      const manuscript = await db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, parseInt(req.params.manuscriptId)),
      });

      if (!manuscript) {
        return res.status(404).json({ message: 'Manuscript not found' });
      }

      if (manuscript.authorId !== user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Get both chunks
      const [chunk1, chunk2] = await Promise.all([
        db.query.chunks.findFirst({ where: eq(chunks.id, chunk1Id) }),
        db.query.chunks.findFirst({ where: eq(chunks.id, chunk2Id) })
      ]);

      if (!chunk1 || !chunk2) {
        return res.status(404).json({ message: 'One or both chunks not found' });
      }

      // Merge chunks
      const mergedText = `${chunk1.text}\n\n${chunk2.text}`;
      const [updatedChunk] = await db
        .update(chunks)
        .set({ 
          text: mergedText,
          updatedAt: new Date()
        })
        .where(eq(chunks.id, chunk1Id))
        .returning();

      // Delete the second chunk
      await db.delete(chunks).where(eq(chunks.id, chunk2Id));

      // Reorder remaining chunks
      await db
        .update(chunks)
        .set({ 
          chunkOrder: sql`${chunks.chunkOrder} - 1` 
        })
        .where(sql`${chunks.chunkOrder} > ${chunk2.chunkOrder}`);

      res.json(updatedChunk);
    } catch (error) {
      console.error('Error merging chunks:', error);
      res.status(500).json({ message: 'Failed to merge chunks' });
    }
  });

  // Split chunk
  app.post('/api/manuscripts/:manuscriptId/chunks/:id/split', requireAuth, async (req, res) => {
    try {
      const { splitPoint } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Verify manuscript ownership
      const manuscript = await db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, parseInt(req.params.manuscriptId)),
      });

      if (!manuscript) {
        return res.status(404).json({ message: 'Manuscript not found' });
      }

      if (manuscript.authorId !== user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Get the chunk to split
      const chunk = await db.query.chunks.findFirst({
        where: eq(chunks.id, parseInt(req.params.id)),
      });

      if (!chunk) {
        return res.status(404).json({ message: 'Chunk not found' });
      }

      // Increment order of all chunks after this one
      await db
        .update(chunks)
        .set({ 
          chunkOrder: sql`${chunks.chunkOrder} + 1` 
        })
        .where(sql`${chunks.chunkOrder} > ${chunk.chunkOrder}`);

      // Update original chunk with first part
      const [updatedChunk1] = await db
        .update(chunks)
        .set({ 
          text: chunk.text.slice(0, splitPoint),
          updatedAt: new Date()
        })
        .where(eq(chunks.id, chunk.id))
        .returning();

      // Create new chunk with second part
      const [newChunk] = await db
        .insert(chunks)
        .values({
          manuscriptId: chunk.manuscriptId,
          text: chunk.text.slice(splitPoint),
          chunkOrder: chunk.chunkOrder + 1,
        })
        .returning();

      res.json({ chunk1: updatedChunk1, chunk2: newChunk });
    } catch (error) {
      console.error('Error splitting chunk:', error);
      res.status(500).json({ message: 'Failed to split chunk' });
    }
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

  app.post('/api/manuscripts/:id/generate-images', async (req, res) => {
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

      const manuscript = await db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, parseInt(req.params.id)),
      });

      if (!manuscript) {
        return res.status(404).json({ message: 'Manuscript not found' });
      }

      if (manuscript.authorId !== user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Get chunks without images
      const chunksWithoutImages = await db.query.chunks.findMany({
        where: eq(chunks.manuscriptId, manuscript.id),
        columns: {
          id: true,
          text: true,
        },
        with: {
          images: {
            columns: {
              id: true,
            },
            limit: 1
          }
        }
      });

      const chunksToGenerate = chunksWithoutImages.filter(chunk => chunk.images.length === 0);

      // Start generating images for chunks without images
      for (const chunk of chunksToGenerate) {
        try {
          console.log(`Generating image for chunk ${chunk.id}`);
          const imageUrl = await generateImage(
            chunk.text,
            manuscript.imageSettings as any,
            null // No character reference for batch generation
          );

          await db.insert(images).values({
            manuscriptId: manuscript.id,
            chunkId: chunk.id,
            localPath: imageUrl,
            promptParams: { prompt: chunk.text },
          });

          console.log(`Generated image for chunk ${chunk.id}`);
        } catch (error) {
          console.error(`Failed to generate image for chunk ${chunk.id}:`, error);
          // Continue with next chunk even if one fails
          continue;
        }
      }

      res.status(202).json({ 
        message: 'Image generation started',
        totalChunks: chunksToGenerate.length
      });
    } catch (error) {
      console.error('Error in batch image generation:', error);
      res.status(500).json({ message: 'Failed to start image generation' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper functions
async function parseMarkdown(markdown: string) {
  // Simple markdown parsing - replace with a robust parser for production
  const lines = markdown.split('\n');
  const chunks: any[] = [];
  let currentChunk: any = { text: '', headingH1: null, order: chunks.length + 1 };

  for (const line of lines) {
    if (line.trim().startsWith('# ')) {
      if (currentChunk.text) {
        chunks.push(currentChunk);
      }
      currentChunk = { text: '', headingH1: line.trim().substring(2), order: chunks.length + 1 };
    } else {
      currentChunk.text += line + '\n';
    }
  }

  if (currentChunk.text) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function generateImage(prompt: string, settings: any, characterReferenceUrl: string | null): Promise<string> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  // Call Replicate API for image generation
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      input: {
        prompt,
        negative_prompt: "blurry, bad anatomy, bad hands, cropped, worst quality",
        num_inference_steps: 50,
        guidance_scale: 7.5,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Replicate API error: ${response.statusText}`);
  }

  const prediction = await response.json();
  console.log('Image generation started:', prediction);

  // Return the generated image URL
  return prediction.output?.[0] || null;
}

function getPublicUrl(req: any): string {
  const baseUrl = process.env.NODE_ENV === 'production' ? 'https://your-production-url.com' : `http://localhost:${process.env.PORT || 3000}`;
  return `${baseUrl}/public/`;
}