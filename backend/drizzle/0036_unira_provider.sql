CREATE TABLE `user_auth_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`provider` varchar(50) DEFAULT 'unira' NOT NULL,
	`provider_user_id` varchar(191) NOT NULL,
	`provider_username` varchar(100),
	`created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `user_auth_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_auth_providers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `user_auth_providers_provider_uid_uniq` ON `user_auth_providers` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE INDEX `user_auth_providers_user_idx` ON `user_auth_providers` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_auth_providers_username_idx` ON `user_auth_providers` (`provider`,`provider_username`);
