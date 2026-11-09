CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`course_id` int NOT NULL,
	`invoice` varchar(50) NOT NULL,
	`method` enum('qris') NOT NULL DEFAULT 'qris',
	`amount_expected` int NOT NULL,
	`amount_paid` int,
	`voucher_code` varchar(100),
	`discount_amount` int NOT NULL DEFAULT 0,
	`proof_file_id` int,
	`status` enum('menunggu','diverifikasi','ditolak') NOT NULL DEFAULT 'menunggu',
	`reject_reason` varchar(500),
	`verified_by` int,
	`verified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_invoice_unique` UNIQUE(`invoice`)
);
--> statement-breakpoint
ALTER TABLE `files` MODIFY COLUMN `kind` enum('image','audio','pdf','cover','assignment','applicant_image','applicant_cv','payment_proof') NOT NULL DEFAULT 'image';--> statement-breakpoint
ALTER TABLE `vouchers` MODIFY COLUMN `kind` enum('personal','umum','diskon') NOT NULL DEFAULT 'umum';--> statement-breakpoint
ALTER TABLE `vouchers` ADD `discount_type` enum('percent','nominal');--> statement-breakpoint
ALTER TABLE `vouchers` ADD `discount_value` int;--> statement-breakpoint
CREATE INDEX `payments_user_course_idx` ON `payments` (`user_id`,`course_id`,`status`);--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_voucher_code_vouchers_code_fk` FOREIGN KEY (`voucher_code`) REFERENCES `vouchers`(`code`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_proof_file_id_files_id_fk` FOREIGN KEY (`proof_file_id`) REFERENCES `files`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_verified_by_users_id_fk` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;