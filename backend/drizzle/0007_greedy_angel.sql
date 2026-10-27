ALTER TABLE `vouchers` MODIFY COLUMN `status` enum('available','assigned','redeemed','expired','revoked') NOT NULL DEFAULT 'available';--> statement-breakpoint
ALTER TABLE `voucher_redemptions` ADD CONSTRAINT `voucher_redemptions_voucher_user_uniq` UNIQUE(`voucher_code`,`user_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `vouchers_course_idx` ON `vouchers` (`course_id`);