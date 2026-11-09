CREATE TABLE `promo_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`title` varchar(200) NOT NULL,
	`badge_label` varchar(100),
	`type` enum('diskon','kurasi','patungan') NOT NULL DEFAULT 'diskon',
	`discount_percent` int,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`starts_at` timestamp,
	`ends_at` timestamp,
	`proposed_by` int,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_campaigns_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `promo_courses` (
	`campaign_id` int NOT NULL,
	`course_id` int NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`custom_badge` varchar(100),
	CONSTRAINT `promo_courses_campaign_id_course_id_pk` PRIMARY KEY(`campaign_id`,`course_id`)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD `promo_slug` varchar(100);--> statement-breakpoint
CREATE INDEX `promo_campaigns_status_idx` ON `promo_campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `promo_courses_course_idx` ON `promo_courses` (`course_id`);--> statement-breakpoint
ALTER TABLE `promo_campaigns` ADD CONSTRAINT `promo_campaigns_proposed_by_users_id_fk` FOREIGN KEY (`proposed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `promo_campaigns` ADD CONSTRAINT `promo_campaigns_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `promo_courses` ADD CONSTRAINT `promo_courses_campaign_id_promo_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `promo_campaigns`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `promo_courses` ADD CONSTRAINT `promo_courses_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;