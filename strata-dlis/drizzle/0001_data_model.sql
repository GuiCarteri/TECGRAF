CREATE TABLE `file_wells` (
	`file_id` text PRIMARY KEY NOT NULL,
	`well_id` text NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`well_id`) REFERENCES `wells`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `file_wells_well_idx` ON `file_wells` (`well_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`file_id` text,
	`well_id` text,
	`analysis_id` text,
	`source_hash` text NOT NULL,
	`title` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`content` text NOT NULL,
	`source_snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`well_id`) REFERENCES `wells`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reports_owner_created_idx` ON `reports` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_source_hash_idx` ON `reports` (`source_hash`);--> statement-breakpoint
CREATE TABLE `wells` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text,
	`field` text,
	`company` text,
	`identifier` text,
	`origin` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wells_owner_idx` ON `wells` (`owner_id`);--> statement-breakpoint
-- Preserve original labels and metadata. Each legacy file starts with a provisional
-- well; no identity is inferred from names or company labels.
INSERT INTO wells (id,owner_id,name,field,company,origin,created_at,updated_at)
SELECT 'publication:' || id, owner_id, NULLIF(TRIM(well),''), field, company,
       'publication', created_at, created_at FROM files;
--> statement-breakpoint
INSERT INTO file_wells (file_id,well_id)
SELECT id, 'publication:' || id FROM files;
--> statement-breakpoint
CREATE TRIGGER files_create_well AFTER INSERT ON files BEGIN
  INSERT INTO wells (id,owner_id,name,field,company,origin,created_at,updated_at)
  VALUES ('publication:' || NEW.id,NEW.owner_id,NULLIF(TRIM(NEW.well),''),NEW.field,NEW.company,'publication',NEW.created_at,NEW.created_at);
  INSERT INTO file_wells (file_id,well_id) VALUES (NEW.id,'publication:' || NEW.id);
END;
