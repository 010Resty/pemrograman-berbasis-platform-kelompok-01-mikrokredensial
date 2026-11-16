ALTER TABLE `files` ADD `width` int;--> statement-breakpoint
ALTER TABLE `files` ADD `height` int;--> statement-breakpoint
ALTER TABLE `files` ADD `original_size_bytes` int;--> statement-breakpoint
CREATE TABLE `file_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_id` int NOT NULL,
	`width` int NOT NULL,
	`storage_key` varchar(255) NOT NULL,
	`size_bytes` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `file_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `file_variants_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE INDEX `file_variants_file_idx` ON `file_variants` (`file_id`);--> statement-breakpoint
ALTER TABLE `file_variants` ADD CONSTRAINT `file_variants_file_id_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE cascade ON UPDATE cascade;
