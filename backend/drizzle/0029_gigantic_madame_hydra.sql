ALTER TABLE `users` ADD `signature_file_id` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_signature_file_id_files_id_fk` FOREIGN KEY (`signature_file_id`) REFERENCES `files`(`id`) ON DELETE set null ON UPDATE cascade;
