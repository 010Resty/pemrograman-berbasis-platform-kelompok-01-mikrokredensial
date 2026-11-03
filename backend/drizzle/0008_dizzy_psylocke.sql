CREATE TABLE `email_verification_pending` (
	`email` varchar(191) NOT NULL,
	`name` varchar(100) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`last_sent_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_verification_pending_email` PRIMARY KEY(`email`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_otps` (
	`email` varchar(191) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`last_sent_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_otps_email` PRIMARY KEY(`email`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` timestamp;--> statement-breakpoint
UPDATE `users` SET `email_verified_at` = NOW() WHERE `email_verified_at` IS NULL;--> statement-breakpoint
CREATE INDEX `certificates_course_status_idx` ON `certificates` (`course_id`,`status`);--> statement-breakpoint
CREATE INDEX `certificates_module_idx` ON `certificates` (`module_id`);--> statement-breakpoint
CREATE INDEX `certificates_issued_idx` ON `certificates` (`issued_at`);--> statement-breakpoint
CREATE INDEX `enrollments_course_status_idx` ON `enrollments` (`course_id`,`status`);--> statement-breakpoint
CREATE INDEX `materials_module_idx` ON `materials` (`module_id`);--> statement-breakpoint
CREATE INDEX `modules_course_idx` ON `modules` (`course_id`);--> statement-breakpoint
CREATE INDEX `progress_material_idx` ON `progress` (`material_id`);