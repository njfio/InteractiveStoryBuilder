import { createClient } from '@supabase/supabase-js';

if (!process.env.REPLICATE_API_TOKEN) {
  throw new Error('Missing REPLICATE_API_TOKEN environment variable');
}

export async function generateImage(prompt: string): Promise<string> {
  console.log('Sending request to Replicate API for image generation...');
  
  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: "2d2d2cfa6f0f3f525e08aafd87b6a32632ee2e9e02def46d5dcd396dbb3fded0",
      input: {
        prompt,
        seed: Math.floor(Math.random() * 1000000),
        aspect_ratio: "3:4",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Replicate API error:', error);
    throw new Error(`Failed to generate image: ${error}`);
  }

  const prediction = await response.json();
  console.log('Prediction created:', prediction.id);

  // Poll for the result
  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });
    
    if (!pollResponse.ok) {
      throw new Error('Failed to check prediction status');
    }
    
    result = await pollResponse.json();
    console.log('Prediction status:', result.status);
  }

  if (result.status === 'failed') {
    throw new Error('Image generation failed');
  }

  const imageUrl = result.output[0];
  console.log('Image generated successfully:', imageUrl);
  return imageUrl;
}
