CREATE TABLE `payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructor_id` int NOT NULL,
	`amount` int NOT NULL,
	`bank_name` varchar(100) NOT NULL,
	`account_number` varchar(50) NOT NULL,
	`account_name` varchar(150) NOT NULL,
	`status` enum('diajukan','diproses','berhasil','ditolak') NOT NULL DEFAULT 'diajukan',
	`reject_reason` varchar(500),
	`decided_by` int,
	`decided_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payouts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payment_id` int NOT NULL,
	`instructor_id` int NOT NULL,
	`course_id` int NOT NULL,
	`amount_paid` int NOT NULL,
	`percent` int NOT NULL,
	`amount` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revenue_ledger_id` PRIMARY KEY(`id`),
	CONSTRAINT `revenue_ledger_payment_id_unique` UNIQUE(`payment_id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructor_percent` int NOT NULL DEFAULT 70,
	`min_withdrawal` int NOT NULL DEFAULT 100000,
	`updated_by` int,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenue_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `payouts_instructor_idx` ON `payouts` (`instructor_id`);--> statement-breakpoint
CREATE INDEX `payouts_status_idx` ON `payouts` (`status`);--> statement-breakpoint
CREATE INDEX `revenue_ledger_instructor_idx` ON `revenue_ledger` (`instructor_id`);--> statement-breakpoint
CREATE INDEX `revenue_ledger_course_idx` ON `revenue_ledger` (`course_id`);--> statement-breakpoint
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_instructor_id_users_id_fk` FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `payouts` ADD CONSTRAINT `payouts_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `revenue_ledger` ADD CONSTRAINT `revenue_ledger_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `revenue_ledger` ADD CONSTRAINT `revenue_ledger_instructor_id_users_id_fk` FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `revenue_ledger` ADD CONSTRAINT `revenue_ledger_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `revenue_settings` ADD CONSTRAINT `revenue_settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
-- Bagi hasil: baris pengaturan awal (persen global 70, minimal Rp100rb).
INSERT INTO `revenue_settings` (`id`, `instructor_percent`, `min_withdrawal`) VALUES (1, 70, 100000) ON DUPLICATE KEY UPDATE `id` = `id`;--> statement-breakpoint
-- Backfill snapshot untuk pembayaran terverifikasi yang sudah ada
-- (kursus berinstruktur saja; persen awal 70).
INSERT INTO `revenue_ledger` (`payment_id`, `instructor_id`, `course_id`, `amount_paid`, `percent`, `amount`)
SELECT p.`id`, c.`created_by`, p.`course_id`, p.`amount_paid`, 70, FLOOR(p.`amount_paid` * 70 / 100)
FROM `payments` p
INNER JOIN `courses` c ON c.`id` = p.`course_id`
WHERE p.`status` = 'diverifikasi' AND p.`amount_paid` IS NOT NULL AND c.`created_by` IS NOT NULL
ON DUPLICATE KEY UPDATE `payment_id` = `payment_id`;