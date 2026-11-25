CREATE TABLE `interface_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`locale` text,
	`theme` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
