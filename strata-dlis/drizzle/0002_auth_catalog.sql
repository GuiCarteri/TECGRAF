CREATE TABLE `auth_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_attempts_expiry` ON `auth_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `catalog_index` (
	`file_id` text PRIMARY KEY NOT NULL,
	`summary` text NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `local_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`confirmed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_accounts_email_unique` ON `local_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `local_mail` (
	`account_id` text NOT NULL,
	`purpose` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `local_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_mail_owner_purpose` ON `local_mail` (`account_id`,`purpose`);--> statement-breakpoint
CREATE TABLE `local_sessions` (
	`access_hash` text PRIMARY KEY NOT NULL,
	`refresh_hash` text NOT NULL,
	`account_id` text NOT NULL,
	`access_until` integer NOT NULL,
	`refresh_until` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `local_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_sessions_refresh_hash_unique` ON `local_sessions` (`refresh_hash`);--> statement-breakpoint
CREATE INDEX `local_sessions_owner_idx` ON `local_sessions` (`account_id`);
--> statement-breakpoint
ALTER TABLE uploads ADD COLUMN cancelled integer NOT NULL DEFAULT 0;
--> statement-breakpoint
-- A projeção também indexa publicações anteriores sem reabrir nem alterar o DLIS.
CREATE VIEW catalog_projection AS SELECT id AS file_id, json_object(
  'wells', (SELECT json_group_array(DISTINCT o.value->>'$.wellName') FROM json_each(doc,'$.logicalFiles') l,
    json_each(CASE WHEN json_type(l.value,'$.origins')='array' THEN l.value->'$.origins' ELSE json_array(json(l.value->'$.origin')) END) o
    WHERE l.type='object' AND o.type='object' AND typeof(o.value->>'$.wellName')='text' AND length(o.value->>'$.wellName')>0),
  'fields', (SELECT json_group_array(DISTINCT o.value->>'$.fieldName') FROM json_each(doc,'$.logicalFiles') l,
    json_each(CASE WHEN json_type(l.value,'$.origins')='array' THEN l.value->'$.origins' ELSE json_array(json(l.value->'$.origin')) END) o
    WHERE l.type='object' AND o.type='object' AND typeof(o.value->>'$.fieldName')='text' AND length(o.value->>'$.fieldName')>0),
  'channels', (SELECT json_group_array(json(item)) FROM (
    SELECT DISTINCT json_object('name',c.value->>'$.name','unit',COALESCE(c.value->>'$.units','')) AS item
    FROM json_each(doc,'$.logicalFiles') l, json_each(l.value,'$.frames') f, json_each(f.value,'$.channels') c
    WHERE l.type='object' AND f.type='object' AND c.type='object' AND typeof(c.value->>'$.name')='text')),
  'toolDetails', (SELECT json_group_array(json(item)) FROM (
    SELECT DISTINCT json_object('name',t.value->>'$.name','genericName',COALESCE(t.value->>'$.genericName',''),'trademarkName',COALESCE(t.value->>'$.trademarkName','')) AS item
    FROM json_each(doc,'$.logicalFiles') l, json_each(l.value,'$.tools') t
    WHERE l.type='object' AND t.type='object' AND typeof(t.value->>'$.name')='text')),
  'tools', (SELECT json_group_array(DISTINCT n.value) FROM json_each(doc,'$.logicalFiles') l, json_each(l.value,'$.tools') t,
    json_each(json_array(t.value->>'$.name',t.value->>'$.genericName',t.value->>'$.trademarkName')) n
    WHERE l.type='object' AND t.type='object' AND n.type='text' AND length(n.value)>0),
  'dates', (SELECT json_group_array(DISTINCT o.value->>'$.creationTime') FROM json_each(doc,'$.logicalFiles') l,
    json_each(CASE WHEN json_type(l.value,'$.origins')='array' THEN l.value->'$.origins' ELSE json_array(json(l.value->'$.origin')) END) o
    WHERE l.type='object' AND o.type='object' AND typeof(o.value->>'$.creationTime')='text'),
  'ranges', (SELECT json_group_array(json(v.value->'$.depthRangeMeters')) FROM json_each(doc,'$.validation') v
    WHERE v.type='object' AND v.value->>'$.ok'=1 AND json_type(v.value,'$.depthRangeMeters')='array'
      AND json_type(v.value,'$.depthRangeMeters[0]') IN ('integer','real') AND json_type(v.value,'$.depthRangeMeters[1]') IN ('integer','real')),
  'frameCount', (SELECT COUNT(*) FROM json_each(doc,'$.logicalFiles') l, json_each(l.value,'$.frames') f WHERE l.type='object' AND f.type='object'),
  'samples', (SELECT SUM(v.value->>'$.samples') FROM json_each(doc,'$.validation') v WHERE v.type='object' AND v.value->>'$.ok'=1 AND json_type(v.value,'$.samples')='integer'),
  'thumbnail', json(doc->'$.thumbnail')
) AS summary FROM (SELECT id, CASE WHEN json_valid(metadata) THEN metadata ELSE '{}' END AS doc FROM files);
--> statement-breakpoint
INSERT INTO catalog_index SELECT * FROM catalog_projection;
--> statement-breakpoint
CREATE TRIGGER catalog_file_insert AFTER INSERT ON files BEGIN
 INSERT INTO catalog_index SELECT * FROM catalog_projection WHERE file_id=NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_file_update AFTER UPDATE OF metadata ON files BEGIN
 UPDATE catalog_index SET summary=(SELECT summary FROM catalog_projection WHERE file_id=NEW.id) WHERE file_id=NEW.id;
END;
