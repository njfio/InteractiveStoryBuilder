import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw error || new Error('User not found');
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email || ''
    };

    // Add token to request for downstream use
    req.headers['supabase-auth-token'] = token;

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ 
      message: error instanceof Error ? error.message : 'Invalid token'
    });
  }
}