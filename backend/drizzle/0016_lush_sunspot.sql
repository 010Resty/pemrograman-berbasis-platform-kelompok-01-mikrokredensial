ALTER TABLE `users` ADD `phone` varchar(30);--> statement-breakpoint
ALTER TABLE `users` ADD `gender` enum('L','P');--> statement-breakpoint
ALTER TABLE `users` ADD `birth_place` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `birth_date` date;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_file_id` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_avatar_file_id_files_id_fk` FOREIGN KEY (`avatar_file_id`) REFERENCES `files`(`id`) ON DELETE set null ON UPDATE cascade;