CREATE TABLE `quiz_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question_id` int NOT NULL,
	`position` int NOT NULL,
	`option_text` text NOT NULL,
	`is_correct` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quiz_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`material_id` int NOT NULL,
	`position` int NOT NULL,
	`question_text` text NOT NULL,
	`explanation` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quiz_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `answers` json;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `snapshot` json;--> statement-breakpoint
CREATE INDEX `quiz_options_question_idx` ON `quiz_options` (`question_id`);--> statement-breakpoint
CREATE INDEX `quiz_questions_material_idx` ON `quiz_questions` (`material_id`);--> statement-breakpoint
CREATE INDEX `quiz_attempts_user_material_idx` ON `quiz_attempts` (`user_id`,`material_id`);--> statement-breakpoint
ALTER TABLE `quiz_options` ADD CONSTRAINT `quiz_options_question_id_quiz_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `quiz_questions` ADD CONSTRAINT `quiz_questions_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE cascade;