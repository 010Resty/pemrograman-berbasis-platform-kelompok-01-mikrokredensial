CREATE TABLE `promo_course_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`course_id` int NOT NULL,
	`proposed_by` int,
	`custom_badge` varchar(100),
	`patungan_price` int,
	`note` varchar(500),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`decided_by` int,
	`decided_at` timestamp,
	`decided_note` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_course_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `promo_proposals_status_idx` ON `promo_course_proposals` (`status`);--> statement-breakpoint
CREATE INDEX `promo_proposals_course_idx` ON `promo_course_proposals` (`course_id`);--> statement-breakpoint
CREATE INDEX `promo_proposals_campaign_idx` ON `promo_course_proposals` (`campaign_id`);--> statement-breakpoint
ALTER TABLE `promo_course_proposals` ADD CONSTRAINT `promo_course_proposals_campaign_id_promo_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `promo_campaigns`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `promo_course_proposals` ADD CONSTRAINT `promo_course_proposals_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `promo_course_proposals` ADD CONSTRAINT `promo_course_proposals_proposed_by_users_id_fk` FOREIGN KEY (`proposed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `promo_course_proposals` ADD CONSTRAINT `promo_course_proposals_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;
