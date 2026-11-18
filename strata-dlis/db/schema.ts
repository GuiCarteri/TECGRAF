import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: text("created_at").notNull(),
});
export const files = sqliteTable(
  "files",
  {
    id: text("id").primaryKey(),
    hash: text("hash").notNull(),
    ownerId: text("owner_id").notNull(),
    publisher: text("publisher").notNull(),
    originalName: text("original_name").notNull(),
    size: integer("size").notNull(),
    objectKey: text("object_key").notNull(),
    well: text("well"),
    field: text("field"),
    company: text("company"),
    collection: text("collection").notNull(),
    run: text("run"),
    location: text("location").notNull().default("unknown"),
    types: text("types").notNull().default("[]"),
    depthLabel: text("depth_label"),
    metadata: text("metadata").notNull(),
    status: text("status").notNull().default("pending"),
    visibility: text("visibility").notNull().default("public"),
    authorization: integer("authorization").notNull(),
    reviewNote: text("review_note"),
    createdAt: text("created_at").notNull(),
    publishedAt: text("published_at"),
    reviewerId: text("reviewer_id"),
  },
  (t) => [
    uniqueIndex("files_hash_unique").on(t.hash),
    index("files_catalog_idx").on(t.status, t.visibility),
    index("files_owner_idx").on(t.ownerId),
  ],
);
export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  objectKey: text("object_key").notNull(),
  uploadId: text("upload_id").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  hash: text("hash").notNull(),
  createdAt: text("created_at").notNull(),
});
export const analyses = sqliteTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    hash: text("hash").notNull(),
    fileName: text("file_name").notNull(),
    name: text("name").notNull(),
    points: text("points").notNull().default("[]"),
    settings: text("settings").notNull().default("{}"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("analyses_owner_hash_idx").on(t.ownerId, t.hash)],
);
export const history = sqliteTable(
  "history",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    hash: text("hash").notNull(),
    fileId: text("file_id"),
    fileName: text("file_name").notNull(),
    accessedAt: text("accessed_at").notNull(),
  },
  (t) => [uniqueIndex("history_owner_hash_idx").on(t.ownerId, t.hash)],
);
export const exportsLog = sqliteTable(
  "exports_log",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    analysisId: text("analysis_id"),
    hash: text("hash").notNull(),
    format: text("format").notNull(),
    count: integer("count").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("exports_owner_idx").on(t.ownerId)],
);

// Canonical wells are explicitly linked; equal names never imply identity.
export const wells = sqliteTable(
  "wells",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name"),
    field: text("field"),
    company: text("company"),
    identifier: text("identifier"),
    origin: text("origin").notNull().default("manual"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("wells_owner_idx").on(t.ownerId)],
);

export const fileWells = sqliteTable(
  "file_wells",
  {
    fileId: text("file_id")
      .primaryKey()
      .references(() => files.id, { onDelete: "cascade" }),
    wellId: text("well_id")
      .notNull()
      .references(() => wells.id, { onDelete: "restrict" }),
  },
  (t) => [index("file_wells_well_idx").on(t.wellId)],
);

// Reports are immutable snapshots, independent of subsequent interpretation edits.
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    fileId: text("file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    wellId: text("well_id").references(() => wells.id, {
      onDelete: "set null",
    }),
    analysisId: text("analysis_id").references(() => analyses.id, {
      onDelete: "set null",
    }),
    sourceHash: text("source_hash").notNull(),
    title: text("title").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    content: text("content").notNull(),
    sourceSnapshot: text("source_snapshot").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("reports_owner_created_idx").on(t.ownerId, t.createdAt),
    index("reports_source_hash_idx").on(t.sourceHash),
  ],
);
