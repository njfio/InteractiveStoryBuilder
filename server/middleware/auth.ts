import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { db } from '@db';
import { users } from '@db/schema';
import { eq } from 'drizzle-orm';

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.error('No authorization header present');
    return res.status(401).json({ message: 'No authorization header' });
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Auth error:', error);
      throw error || new Error('User not found');
    }

    // Ensure user exists in our database
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!dbUser) {
      // Create user if they don't exist
      await db.insert(users).values({
        id: user.id,
        email: user.email || '',
      }).onConflictDoNothing();
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email || ''
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ 
      message: error instanceof Error ? error.message : 'Invalid token'
    });
  }
}