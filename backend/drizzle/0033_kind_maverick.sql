ALTER TABLE `patungan_groups` MODIFY COLUMN `status` enum('pending','complete','cancelled','expired') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `patungan_group_members` ADD `invite_status` enum('pending','accepted','declined') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `patungan_groups` ADD `expires_at` timestamp;--> statement-breakpoint
UPDATE `patungan_group_members` SET `invite_status`='accepted' WHERE `invite_status`='pending';--> statement-breakpoint
UPDATE `patungan_groups` SET `expires_at`=DATE_ADD(`created_at`, INTERVAL 3 DAY) WHERE `status`='pending' AND `expires_at` IS NULL;