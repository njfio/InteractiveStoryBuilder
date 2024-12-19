import type { Express, Request } from 'express';
import { createServer, type Server } from 'http';
import { db } from '@db';
import { manuscripts, chunks, images, seoMetadata, users } from '@db/schema';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import EPub from 'epub-gen';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Default base URL for local development
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
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
      columns: {
        id: true,
        title: true,
        authorId: true,
        imageSettings: true,
        updatedAt: true,
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
    console.time('chunks-query');
    try {
      const results = await db.query.chunks.findMany({
        where: eq(chunks.manuscriptId, parseInt(req.params.id)),
        columns: {
          id: true,
          manuscriptId: true,
          chunkOrder: true,
          headingH1: true,
          headingH2: true,
          text: true,
        },
        with: {
          images: {
            columns: {
              localPath: true,
            },
            limit: 1,
          },
          manuscript: {
            columns: {
              id: true,
              title: true,
              authorId: true,
              imageSettings: true,
            }
          }
        },
        orderBy: (chunks, { asc }) => [asc(chunks.chunkOrder)],
      });

      const chunksWithImages = results.map(chunk => ({
        ...chunk,
        imageUrl: chunk.images?.[0]?.localPath
      }));

      console.timeEnd('chunks-query');
      res.json(chunksWithImages);
    } catch (error) {
      console.error('Error fetching chunks:', error);
      res.status(500).json({ message: 'Failed to fetch chunks' });
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

    const [total, chunksCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(images)
        .where(eq(images.manuscriptId, parseInt(req.params.id))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(chunks)
        .where(eq(chunks.manuscriptId, parseInt(req.params.id)))
    ]);

    res.json({
      images: results,
      totalChunks: chunksCount[0].count,
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
  // Export Manuscript
  app.get('/api/manuscripts/:id/export', async (req, res) => {
    try {
      const format = req.query.format as string;
      if (!['epub', 'markdown', 'docx'].includes(format)) {
        return res.status(400).json({ message: 'Invalid export format' });
      }

      const manuscript = await db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, parseInt(req.params.id)),
        columns: {
          title: true,
          originalMarkdown: true,
        },
      });

      if (!manuscript) {
        return res.status(404).json({ message: 'Manuscript not found' });
      }

      console.log('Fetching chunks and images...');
      const chunksWithImages = await db.query.chunks.findMany({
        where: eq(chunks.manuscriptId, parseInt(req.params.id)),
        orderBy: (chunks, { asc }) => [asc(chunks.chunkOrder)],
        with: {
          images: {
            limit: 1, // Get the latest image for each chunk
            orderBy: (images, { desc }) => [desc(images.createdAt)]
          }
        }
      });

      console.log(`Found ${chunksWithImages.length} chunks`);
      
      console.log('Starting manuscript export process...');
      
      const execAsync = promisify(exec);
      const tmpDir = '/tmp';

      console.log('Ensuring tmp directory exists...');
      try {
        await fs.access(tmpDir);
        console.log('Tmp directory exists');
      } catch {
        console.log('Creating tmp directory...');
        await fs.mkdir(tmpDir, { recursive: true });
      }

      // Create a temporary directory for the export
      const exportDir = join(tmpDir, `export-${Date.now()}`);
      await fs.mkdir(exportDir, { recursive: true });
      await fs.mkdir(join(exportDir, 'images'), { recursive: true });

      // Clean up function for temporary files
      const cleanupFiles = async (...files: string[]) => {
        console.log('Cleaning up temporary files:', files);
        for (const file of files) {
          try {
            await fs.unlink(file);
            console.log(`Successfully deleted temporary file: ${file}`);
          } catch (err) {
            console.error(`Failed to cleanup file ${file}:`, err);
          }
        }
      };

      const sanitizedTitle = manuscript.title.replace(/[^a-zA-Z0-9]/g, '_');
      console.log(`Preparing to export manuscript "${manuscript.title}" in ${format} format`);

      // Compile content from chunks
      let content = `# ${manuscript.title}\n\n`;
      let currentChapter: string | null = null;
      
      for (const chunk of chunksWithImages) {
        // Only add chapter heading if it's different from the current one
        if (chunk.headingH1 && chunk.headingH1 !== currentChapter) {
          content += `# ${chunk.headingH1}\n\n`;
          currentChapter = chunk.headingH1;
        }
        
        // Add subheading if present
        if (chunk.headingH2 && chunk.headingH2 !== chunk.text) {
          content += `## ${chunk.headingH2}\n\n`;
        }
        
        // Add the chunk text, but skip if it matches the heading
        if (chunk.text !== chunk.headingH1 && chunk.text !== chunk.headingH2) {
          content += `${chunk.text}\n\n`;
        }
        
        // Handle image if exists
        if (chunk.images?.[0]?.localPath) {
          const sourceImagePath = join(process.cwd(), 'public', chunk.images[0].localPath);
          const imageFilename = chunk.images[0].localPath.split('/').pop();
          const targetImagePath = join(exportDir, 'images', imageFilename!);
          
          try {
            await fs.copyFile(sourceImagePath, targetImagePath);
            if (format === 'markdown') {
              // For markdown, use the full URL path
              content += `![Generated illustration](${BASE_URL}${chunk.images[0].localPath})\n\n`;
            } else if (format === 'docx') {
              // For DOCX, use relative path that pandoc can resolve
              content += `![Generated illustration](${join('images', imageFilename!)})\n\n`;
            } else {
              // For EPUB, use a path that will work within the EPUB container
              content += `![Generated illustration](${join('OEBPS/images', imageFilename!)})\n\n`;
            }
          } catch (err) {
            console.error(`Failed to copy image ${sourceImagePath}:`, err);
            // Continue without the image if it can't be copied
          }
        }
      }

      switch (format) {
        case 'markdown':
          console.log('Exporting as Markdown...');
          res.set('Content-Type', 'text/markdown');
          res.set('Content-Disposition', `attachment; filename="${sanitizedTitle}.md"`);
          return res.send(content);

        case 'epub':
          console.log('Starting EPUB generation...');
          const epubFilePath = join(tmpDir, `${sanitizedTitle}.epub`);
          
          try {
            console.log('Configuring EPUB generator...');
            // Group chunks by chapter for EPUB
            let currentChapterContent = '';
            let chapters = [];
            let lastChapter = null;

            for (const chunk of chunksWithImages) {
              if (chunk.headingH1 && chunk.headingH1 !== lastChapter) {
                if (lastChapter) {
                  chapters.push({
                    title: lastChapter,
                    data: currentChapterContent
                  });
                  currentChapterContent = '';
                }
                lastChapter = chunk.headingH1;
              }

              if (chunk.headingH2 && chunk.headingH2 !== chunk.text) {
                currentChapterContent += `<h2>${chunk.headingH2}</h2>\n`;
              }

              if (chunk.text !== chunk.headingH1 && chunk.text !== chunk.headingH2) {
                currentChapterContent += `<p>${chunk.text}</p>\n`;
              }

              if (chunk.images?.[0]?.localPath) {
                const sourceImagePath = join(process.cwd(), 'public', chunk.images[0].localPath);
                const imageFilename = chunk.images[0].localPath.split('/').pop();
                const targetImagePath = join(exportDir, 'images', imageFilename!);
                
                try {
                  await fs.copyFile(sourceImagePath, targetImagePath);
                  currentChapterContent += `<img src="../images/${imageFilename}" alt="Generated illustration" class="chapter-image"/>`;
                } catch (err) {
                  console.error(`Failed to copy image for EPUB:`, err);
                }
              }
            }

            // Add the last chapter
            if (lastChapter && currentChapterContent) {
              chapters.push({
                title: lastChapter,
                data: currentChapterContent
              });
            }

            // Create EPUB structure
            const epubContentDir = join(exportDir, 'OEBPS');
            const epubImagesDir = join(epubContentDir, 'images');
            await fs.mkdir(epubContentDir, { recursive: true });
            await fs.mkdir(epubImagesDir, { recursive: true });

            // Copy images to EPUB content directory
            for (const chunk of chunksWithImages) {
              if (chunk.images?.[0]?.localPath) {
                const sourceImagePath = join(process.cwd(), 'public', chunk.images[0].localPath);
                const imageFilename = chunk.images[0].localPath.split('/').pop();
                const epubImagePath = join(epubImagesDir, imageFilename!);
                try {
                  await fs.copyFile(sourceImagePath, epubImagePath);
                } catch (err) {
                  console.error(`Failed to copy image for EPUB:`, err);
                }
              }
            }

            const epub = new EPub({
              title: manuscript.title,
              content: chapters,
              tempDir: exportDir,
              contentDir: 'OEBPS'
            }, epubFilePath);

            console.log('Generating EPUB file...');
            await epub.promise;
            console.log('EPUB generation completed successfully');

            res.download(epubFilePath, `${sanitizedTitle}.epub`, () => {
              console.log('EPUB download completed, cleaning up...');
              cleanupFiles(exportDir, epubFilePath);
            });
          } catch (error) {
            console.error('EPUB generation error:', error);
            await cleanupFiles(exportDir);
            throw new Error('Failed to generate EPUB');
          }
          break;

        case 'docx':
          console.log('Starting DOCX conversion...');
          const inputFile = join(exportDir, `${sanitizedTitle}.md`);
          const outputFile = join(exportDir, `${sanitizedTitle}.docx`);
          
          try {
            console.log('Writing markdown content to temporary file...');
            await fs.writeFile(inputFile, content);
            
            console.log('Converting markdown to DOCX using pandoc with images...');
            // Use pandoc with the correct working directory to ensure images are found
            await execAsync(`cd "${exportDir}" && pandoc "${sanitizedTitle}.md" -o "${sanitizedTitle}.docx" --embed-resources --standalone`);
            console.log('DOCX conversion completed successfully');
            
            res.download(outputFile, `${sanitizedTitle}.docx`, () => {
              console.log('DOCX download completed, cleaning up...');
              cleanupFiles(exportDir);
            });
          } catch (error) {
            console.error('DOCX conversion error:', error);
            await cleanupFiles(exportDir);
            throw new Error('Failed to convert to DOCX');
          }
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ 
        message: (error as Error).message || 'Failed to export manuscript' 
      });
    }
  });

  return httpServer;
}