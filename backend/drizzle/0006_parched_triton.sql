-- Tahap 3: perluasan certificates (aditif). Baris lama di-backfill agar
-- migrasi tetap jalan pada database dev yang sudah berisi seed lama:
-- course_id dari modul, recipient_name dari users, code legacy deterministik.
ALTER TABLE `certificates` ADD `course_id` int;--> statement-breakpoint
ALTER TABLE `certificates` ADD `code` varchar(32);--> statement-breakpoint
ALTER TABLE `certificates` ADD `recipient_name` varchar(100);--> statement-breakpoint
ALTER TABLE `certificates` ADD `requirements_snapshot` json;--> statement-breakpoint
ALTER TABLE `certificates` ADD `revoke_reason` varchar(500);--> statement-breakpoint
ALTER TABLE `certificates` ADD `revoked_by` int;--> statement-breakpoint
ALTER TABLE `certificates` ADD `revoked_at` timestamp;--> statement-breakpoint
UPDATE `certificates` `c` INNER JOIN `modules` `m` ON `m`.`id` = `c`.`module_id` SET `c`.`course_id` = `m`.`course_id` WHERE `c`.`course_id` IS NULL;--> statement-breakpoint
UPDATE `certificates` `c` INNER JOIN `users` `u` ON `u`.`id` = `c`.`user_id` SET `c`.`recipient_name` = `u`.`name` WHERE `c`.`recipient_name` IS NULL;--> statement-breakpoint
UPDATE `certificates` SET `code` = CONCAT('ATS-LEGACY-', `id`) WHERE `code` IS NULL;--> statement-breakpoint
DELETE FROM `certificates` WHERE `course_id` IS NULL OR `code` IS NULL OR `recipient_name` IS NULL;--> statement-breakpoint
ALTER TABLE `certificates` MODIFY COLUMN `course_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `certificates` MODIFY COLUMN `code` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `certificates` MODIFY COLUMN `recipient_name` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_code_unique` UNIQUE(`code`);--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_user_module_uniq` UNIQUE(`user_id`,`module_id`);--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_revoked_by_users_id_fk` FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;
