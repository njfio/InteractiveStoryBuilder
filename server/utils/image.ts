import { createClient } from '@supabase/supabase-js';

if (!process.env.REPLICATE_API_TOKEN) {
  throw new Error('Missing REPLICATE_API_TOKEN environment variable');
}

import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

if (!process.env.REPLICATE_API_TOKEN) {
  throw new Error('Missing REPLICATE_API_TOKEN environment variable');
}

async function downloadImage(url: string, localPath: string): Promise<void> {
  console.log('Downloading image from:', url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to download image');
  
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(localPath, buffer);
  console.log('Image saved to:', localPath);
}

export async function generateImage(prompt: string): Promise<string> {
  console.log('Sending request to Replicate API for image generation...');
  
  const response = await fetch('https://api.replicate.com/v1/models/luma/photon/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt,
        seed: Math.floor(Math.random() * 1000000),
        aspect_ratio: "9:16"
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Replicate API error:', error);
    throw new Error(`Failed to generate image: ${error}`);
  }

  const result = await response.json();
  console.log('API response:', result);

  if (!result.output) {
    throw new Error('No output from image generation');
  }

  const imageUrl = result.output[0];
  console.log('Image URL from API:', imageUrl);

  // Create images directory if it doesn't exist
  const imagesDir = path.join(process.cwd(), 'public', 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  // Generate a unique filename
  const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
  const localPath = path.join(imagesDir, filename);

  // Download and save the image
  await downloadImage(imageUrl, localPath);

  // Return the local path that can be served by Express
  return `/images/${filename}`;
}
