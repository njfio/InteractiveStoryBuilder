import { pgTable, text, serial, timestamp, jsonb, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const manuscripts = pgTable("manuscripts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorName: text("author_name"),
  isPublic: boolean("is_public").default(false).notNull(),
  originalMarkdown: text("original_markdown").notNull(),
  imageSettings: jsonb("image_settings").default({
    seed: 469,
    prompt: "",
    aspect_ratio: "9:16",
    image_reference_url: null,
    style_reference_url: null,
    image_reference_weight: 0.85,
    style_reference_weight: 0.85
  }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  manuscriptId: integer("manuscript_id").notNull().references(() => manuscripts.id, { onDelete: 'cascade' }),
  chunkOrder: integer("chunk_order").notNull(),
  headingH1: text("heading_h1"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  manuscriptId: integer("manuscript_id").notNull().references(() => manuscripts.id, { onDelete: 'cascade' }),
  chunkId: integer("chunk_id").notNull().references(() => chunks.id, { onDelete: 'cascade' }),
  localPath: text("local_path").notNull(),
  promptParams: jsonb("prompt_params").notNull(),
  characterReferenceUrl: text("character_reference_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const seoMetadata = pgTable("seo_metadata", {
  id: serial("id").primaryKey(),
  manuscriptId: integer("manuscript_id").notNull().references(() => manuscripts.id, { onDelete: 'cascade' }),
  chunkId: integer("chunk_id").references(() => chunks.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  keywords: text("keywords").array(),
  generatedByAi: boolean("generated_by_ai").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const manuscriptRelations = relations(manuscripts, ({ one, many }) => ({
  author: one(users, {
    fields: [manuscripts.authorId],
    references: [users.id],
  }),
  chunks: many(chunks),
  images: many(images),
  seoMetadata: many(seoMetadata),
}));

export const chunkRelations = relations(chunks, ({ one, many }) => ({
  manuscript: one(manuscripts, {
    fields: [chunks.manuscriptId],
    references: [manuscripts.id],
  }),
  images: many(images),
  seoMetadata: many(seoMetadata),
}));

export const imageRelations = relations(images, ({ one }) => ({
  chunk: one(chunks, {
    fields: [images.chunkId],
    references: [chunks.id],
  }),
  manuscript: one(manuscripts, {
    fields: [images.manuscriptId],
    references: [manuscripts.id],
  }),
}));

// Types
export type Manuscript = typeof manuscripts.$inferSelect;
export type NewManuscript = typeof manuscripts.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
export type SeoMetadata = typeof seoMetadata.$inferSelect;
export type NewSeoMetadata = typeof seoMetadata.$inferInsert;