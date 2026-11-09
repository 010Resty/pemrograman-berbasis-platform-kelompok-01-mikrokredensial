ALTER TABLE `certificates` MODIFY COLUMN `module_id` int;--> statement-breakpoint
ALTER TABLE `certificates` MODIFY COLUMN `status` enum('issued','revoked','superseded') NOT NULL DEFAULT 'issued';