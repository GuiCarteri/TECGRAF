CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`hash` text NOT NULL,
	`file_name` text NOT NULL,
	`name` text NOT NULL,
	`points` text DEFAULT '[]' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analyses_owner_hash_idx` ON `analyses` (`owner_id`,`hash`);--> statement-breakpoint
CREATE TABLE `exports_log` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`analysis_id` text,
	`hash` text NOT NULL,
	`format` text NOT NULL,
	`count` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exports_owner_idx` ON `exports_log` (`owner_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`owner_id` text NOT NULL,
	`publisher` text NOT NULL,
	`original_name` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`well` text,
	`field` text,
	`company` text,
	`collection` text NOT NULL,
	`run` text,
	`location` text DEFAULT 'unknown' NOT NULL,
	`types` text DEFAULT '[]' NOT NULL,
	`depth_label` text,
	`metadata` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`authorization` integer NOT NULL,
	`review_note` text,
	`created_at` text NOT NULL,
	`published_at` text,
	`reviewer_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_hash_unique` ON `files` (`hash`);--> statement-breakpoint
CREATE INDEX `files_catalog_idx` ON `files` (`status`,`visibility`);--> statement-breakpoint
CREATE INDEX `files_owner_idx` ON `files` (`owner_id`);--> statement-breakpoint
CREATE TABLE `history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`hash` text NOT NULL,
	`file_id` text,
	`file_name` text NOT NULL,
	`accessed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `history_owner_hash_idx` ON `history` (`owner_id`,`hash`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`upload_id` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text NOT NULL
);
