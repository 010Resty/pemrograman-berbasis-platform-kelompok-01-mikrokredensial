CREATE TABLE `instructor_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(12) NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(191) NOT NULL,
	`about` text,
	`skills` varchar(255),
	`youtube_tutorial` varchar(500),
	`youtube_channel` varchar(500),
	`linkedin` varchar(500),
	`referral_email` varchar(191),
	`photo_file_id` int,
	`cv_file_id` int,
	`cv_name` varchar(255),
	`cv_size` int NOT NULL DEFAULT 0,
	`status` enum('submitted','under_review','approved','rejected') NOT NULL DEFAULT 'submitted',
	`review_note` text,
	`reviewed_by` int,
	`reviewed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instructor_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `instructor_applications_code_unique` UNIQUE(`code`),
	CONSTRAINT `instructor_applications_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `files` MODIFY COLUMN `owner_user_id` int;--> statement-breakpoint
ALTER TABLE `files` MODIFY COLUMN `kind` enum('image','audio','pdf','cover','assignment','applicant_image','applicant_cv') NOT NULL DEFAULT 'image';--> statement-breakpoint
CREATE INDEX `instructor_applications_email_idx` ON `instructor_applications` (`email`);--> statement-breakpoint
CREATE INDEX `instructor_applications_status_idx` ON `instructor_applications` (`status`);--> statement-breakpoint
ALTER TABLE `instructor_applications` ADD CONSTRAINT `instructor_applications_photo_file_id_files_id_fk` FOREIGN KEY (`photo_file_id`) REFERENCES `files`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `instructor_applications` ADD CONSTRAINT `instructor_applications_cv_file_id_files_id_fk` FOREIGN KEY (`cv_file_id`) REFERENCES `files`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `instructor_applications` ADD CONSTRAINT `instructor_applications_reviewed_by_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;