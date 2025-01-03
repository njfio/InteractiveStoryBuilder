import fs from 'fs/promises';
import path from 'path';

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

interface ImageSettings {
  seed?: number;
  prompt?: string;
  aspect_ratio?: string;
  image_reference_url?: string | null;
  style_reference_url?: string | null;
  image_reference_weight?: number;
  style_reference_weight?: number;
}

export async function generateImage(prompt: string, manuscriptSettings: ImageSettings = {}, characterReferenceUrl?: string): Promise<string> {
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
        prompt: manuscriptSettings.prompt ? `${manuscriptSettings.prompt} ${prompt}` : prompt,
        seed: manuscriptSettings.seed || Math.floor(Math.random() * 1000000),
        aspect_ratio: manuscriptSettings.aspect_ratio || "9:16",
        image_reference: manuscriptSettings.image_reference_url || undefined,
        style_reference: manuscriptSettings.style_reference_url || undefined,
        image_reference_weight: manuscriptSettings.image_reference_weight || undefined,
        style_reference_weight: manuscriptSettings.style_reference_weight || undefined,
        character_reference: characterReferenceUrl || undefined
      }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Replicate API error:', error);
    throw new Error(`Failed to generate image: ${error}`);
  }

  const prediction = await response.json();
  console.log('Initial API response:', prediction);

  // Wait for the prediction to complete
  let result = prediction;
  while (result.status === 'processing' || result.status === 'starting') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      },
    });
    
    if (!pollResponse.ok) {
      throw new Error('Failed to check prediction status');
    }
    
    result = await pollResponse.json();
    console.log('Prediction status:', result.status);
  }

  if (result.status === 'failed' || !result.output) {
    throw new Error('Image generation failed: ' + (result.error || 'No output received'));
  }

  if (!result.output || typeof result.output !== 'string') {
    console.error('Unexpected API response format:', result);
    throw new Error('Invalid output format from API');
  }

  const imageUrl = result.output;
  if (!imageUrl.startsWith('http')) {
    console.error('Invalid image URL:', imageUrl);
    throw new Error('Invalid image URL received from API');
  }
  console.log('Final image URL from API:', imageUrl);

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
