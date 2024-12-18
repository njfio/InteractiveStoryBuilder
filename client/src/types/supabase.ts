import { Database as DatabaseGenerated } from './supabase-generated';

export type Database = DatabaseGenerated;

// This is a placeholder until we generate the actual types from Supabase
export type DatabaseGenerated = {
  public: {
    Tables: {
      manuscripts: {
        Row: {
          id: number;
          title: string;
          authorId: string;
          originalMarkdown: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          title: string;
          authorId: string;
          originalMarkdown: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          title?: string;
          authorId?: string;
          originalMarkdown?: string;
          updatedAt?: string;
        };
      };
      chunks: {
        Row: {
          id: number;
          manuscriptId: number;
          chunkOrder: number;
          headingH1: string | null;
          headingH2: string | null;
          text: string;
          createdAt: string;
          updatedAt: string;
        };
        Insert: {
          manuscriptId: number;
          chunkOrder: number;
          headingH1?: string | null;
          headingH2?: string | null;
          text: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: {
          manuscriptId?: number;
          chunkOrder?: number;
          headingH1?: string | null;
          headingH2?: string | null;
          text?: string;
          updatedAt?: string;
        };
      };
    };
  };
};
