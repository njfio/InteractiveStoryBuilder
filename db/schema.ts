import { pgTable, text, serial, timestamp, jsonb, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, type InferModel } from "drizzle-orm";

// Base tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),  
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const manuscripts = pgTable("manuscripts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  manuscripts: many(manuscripts),
}));

export const manuscriptsRelations = relations(manuscripts, ({ one, many }) => ({
  author: one(users, {
    fields: [manuscripts.authorId],
    references: [users.id],
  }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  manuscript: one(manuscripts, {
    fields: [chunks.manuscriptId],
    references: [manuscripts.id],
  }),
}));

// Types
export type User = InferModel<typeof users>;
export type Manuscript = InferModel<typeof manuscripts>;
export type Chunk = InferModel<typeof chunks>;
export type NewUser = InferModel<typeof users, "insert">;
export type NewManuscript = InferModel<typeof manuscripts, "insert">;
export type NewChunk = InferModel<typeof chunks, "insert">;

// Zod Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertManuscriptSchema = createInsertSchema(manuscripts);
export const selectManuscriptSchema = createSelectSchema(manuscripts);
export const insertChunkSchema = createInsertSchema(chunks);
export const selectChunkSchema = createSelectSchema(chunks);