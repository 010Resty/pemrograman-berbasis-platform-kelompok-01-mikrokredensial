ALTER TABLE `payments` ADD `gateway` varchar(20) NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `payments` ADD `doku_reference_id` varchar(100);--> statement-breakpoint
ALTER TABLE `payments` ADD `doku_qr_string` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `doku_expires_at` timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_doku_reference_id_unique` ON `payments` (`doku_reference_id`);
