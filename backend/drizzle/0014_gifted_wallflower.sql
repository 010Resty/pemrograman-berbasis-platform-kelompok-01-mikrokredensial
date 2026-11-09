CREATE TABLE `patungan_group_members` (
	`group_id` int NOT NULL,
	`user_id` int NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`share_amount` int NOT NULL,
	`payment_status` enum('unpaid','menunggu','diverifikasi','ditolak') NOT NULL DEFAULT 'unpaid',
	`payment_id` int,
	`paid_at` timestamp,
	CONSTRAINT `patungan_group_members_group_id_user_id_pk` PRIMARY KEY(`group_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `patungan_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`course_id` int NOT NULL,
	`promo_slug` varchar(100),
	`member_count` int NOT NULL,
	`price_nominal` int NOT NULL,
	`status` enum('pending','complete','cancelled') NOT NULL DEFAULT 'pending',
	`created_by` int,
	`cancelled_by` int,
	`cancel_reason` varchar(500),
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patungan_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `patungan_groups_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `email_verification_pending` ADD `username` varchar(50);
--> statement-breakpoint
ALTER TABLE `payments` ADD `patungan_group_id` int;
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(50);
--> statement-breakpoint
UPDATE `users` SET `username` = LEFT(LOWER(SUBSTRING_INDEX(`email`, '@', 1)), 50) WHERE `username` IS NULL;
--> statement-breakpoint
UPDATE `users` AS `u` JOIN (SELECT `username` FROM `users` GROUP BY `username` HAVING COUNT(*) > 1) AS `d` ON `u`.`username` = `d`.`username` SET `u`.`username` = CONCAT(LEFT(`u`.`username`, 40), '-', `u`.`id`);
--> statement-breakpoint
ALTER TABLE `users` MODIFY `username` varchar(50) NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);
--> statement-breakpoint
CREATE INDEX `patungan_members_user_idx` ON `patungan_group_members` (`user_id`);
--> statement-breakpoint
CREATE INDEX `patungan_groups_course_idx` ON `patungan_groups` (`course_id`);
--> statement-breakpoint
CREATE INDEX `patungan_groups_status_idx` ON `patungan_groups` (`status`);
--> statement-breakpoint
CREATE INDEX `payments_patungan_group_idx` ON `payments` (`patungan_group_id`);
--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_patungan_group_id_patungan_groups_id_fk` FOREIGN KEY (`patungan_group_id`) REFERENCES `patungan_groups`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `patungan_group_members` ADD CONSTRAINT `patungan_group_members_group_id_patungan_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `patungan_groups`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `patungan_group_members` ADD CONSTRAINT `patungan_group_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `patungan_group_members` ADD CONSTRAINT `patungan_group_members_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `patungan_groups` ADD CONSTRAINT `patungan_groups_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `patungan_groups` ADD CONSTRAINT `patungan_groups_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `patungan_groups` ADD CONSTRAINT `patungan_groups_cancelled_by_users_id_fk` FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;
