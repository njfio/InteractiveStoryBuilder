import { pgTable, text, serial, timestamp, jsonb, uuid, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").unique().notNull(),
  display_name: text("display_name"),
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
  headingH2: text("heading_h2"),
  text: text("text").notNull(),
  imageUrl: text("image_url"),
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

export const printifyProducts = pgTable("printify_products", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  imageId: integer("image_id").notNull().references(() => images.id, { onDelete: 'cascade' }),
  productId: text("product_id").notNull(),
  blueprintId: integer("blueprint_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  isPublished: boolean("is_published").default(false),
  printifyData: jsonb("printify_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const printifyImagePlacements = pgTable("printify_image_placements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => printifyProducts.id, { onDelete: 'cascade' }),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  scale: integer("scale").notNull(),
  angle: integer("angle").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const printifyBlueprints = pgTable("printify_blueprints", {
  id: serial("id").primaryKey(),
  blueprintId: integer("blueprint_id").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  variants: jsonb("variants"),
  printAreas: jsonb("print_areas"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const manuscriptRelations = relations(manuscripts, ({ one, many }) => ({
  author: one(users, {
    fields: [manuscripts.authorId],
    references: [users.id],
  }),
  chunks: many(chunks),
  images: many(images),
}));

export const chunkRelations = relations(chunks, ({ one, many }) => ({
  manuscript: one(manuscripts, {
    fields: [chunks.manuscriptId],
    references: [manuscripts.id],
  }),
  images: many(images),
}));

export const imageRelations = relations(images, ({ one, many }) => ({
  chunk: one(chunks, {
    fields: [images.chunkId],
    references: [chunks.id],
  }),
  manuscript: one(manuscripts, {
    fields: [images.manuscriptId],
    references: [manuscripts.id],
  }),
  printifyProducts: many(printifyProducts),
}));

export const printifyProductRelations = relations(printifyProducts, ({ one, many }) => ({
  user: one(users, {
    fields: [printifyProducts.userId],
    references: [users.id],
  }),
  image: one(images, {
    fields: [printifyProducts.imageId],
    references: [images.id],
  }),
  placements: many(printifyImagePlacements),
}));

export const insertManuscriptSchema = createInsertSchema(manuscripts);
export const selectManuscriptSchema = createSelectSchema(manuscripts);
export const insertChunkSchema = createInsertSchema(chunks);
export const selectChunkSchema = createSelectSchema(chunks);
export const insertPrintifyProductSchema = createInsertSchema(printifyProducts);
export const selectPrintifyProductSchema = createSelectSchema(printifyProducts);

export type Manuscript = typeof manuscripts.$inferSelect;
export type NewManuscript = typeof manuscripts.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
export type PrintifyProduct = typeof printifyProducts.$inferSelect;
export type NewPrintifyProduct = typeof printifyProducts.$inferInsert;
export type PrintifyImagePlacement = typeof printifyImagePlacements.$inferSelect;
export type PrintifyBlueprint = typeof printifyBlueprints.$inferSelect;