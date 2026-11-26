CREATE INDEX `certificates_user_status_issued_idx` ON `certificates` (`user_id`,`status`,`issued_at`);--> statement-breakpoint
CREATE INDEX `certificates_status_issued_idx` ON `certificates` (`status`,`issued_at`);--> statement-breakpoint
CREATE INDEX `email_verification_pending_username_idx` ON `email_verification_pending` (`username`);--> statement-breakpoint
CREATE INDEX `enrollments_status_enrolled_idx` ON `enrollments` (`status`,`enrolled_at`);--> statement-breakpoint
CREATE INDEX `patungan_members_group_invite_idx` ON `patungan_group_members` (`group_id`,`invite_status`);--> statement-breakpoint
CREATE INDEX `patungan_groups_status_expires_idx` ON `patungan_groups` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `payments_status_created_idx` ON `payments` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payouts_instructor_status_idx` ON `payouts` (`instructor_id`,`status`);--> statement-breakpoint
CREATE INDEX `promo_campaigns_type_status_idx` ON `promo_campaigns` (`type`,`status`);--> statement-breakpoint
CREATE INDEX `quiz_attempts_material_user_idx` ON `quiz_attempts` (`material_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_replaced_idx` ON `refresh_tokens` (`replaced_by_token_hash`);--> statement-breakpoint
CREATE INDEX `submissions_file_idx` ON `submissions` (`file_id`);--> statement-breakpoint
CREATE INDEX `submissions_material_status_idx` ON `submissions` (`material_id`,`status`);--> statement-breakpoint
CREATE INDEX `users_role_created_idx` ON `users` (`role`,`created_at`);--> statement-breakpoint
CREATE INDEX `vouchers_status_expires_idx` ON `vouchers` (`status`,`expires_at`);