ALTER TABLE `submissions` MODIFY COLUMN `status` enum('submitted','reviewed','revision_requested','passed','failed') NOT NULL DEFAULT 'submitted';--> statement-breakpoint
ALTER TABLE `submissions` ADD `file_id` int;--> statement-breakpoint
ALTER TABLE `submissions` ADD `graded_by` int;--> statement-breakpoint
ALTER TABLE `submissions` ADD `graded_at` timestamp;--> statement-breakpoint
CREATE INDEX `submissions_material_user_idx` ON `submissions` (`material_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_file_id_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_graded_by_users_id_fk` FOREIGN KEY (`graded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;