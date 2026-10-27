CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`module_id` int NOT NULL,
	`credential_id` varchar(100),
	`status` enum('issued','revoked') NOT NULL DEFAULT 'issued',
	`issued_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_credential_id_unique` UNIQUE(`credential_id`)
);
--> statement-breakpoint
CREATE TABLE `course_instructors` (
	`course_id` int NOT NULL,
	`user_id` int NOT NULL,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_instructors_course_id_user_id_pk` PRIMARY KEY(`course_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`level` varchar(50) NOT NULL DEFAULT 'Pemula',
	`duration` varchar(100),
	`image` varchar(500),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`price_label` varchar(100) NOT NULL,
	`price_nominal` int NOT NULL DEFAULT 0,
	`period` varchar(100) NOT NULL,
	`start_month` varchar(100),
	`outcomes` json,
	`requirements` json,
	`tools` json,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`user_id` int NOT NULL,
	`course_id` int NOT NULL,
	`source` varchar(50) NOT NULL,
	`status` enum('active','completed','expired','cancelled') NOT NULL DEFAULT 'active',
	`enrolled_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrollments_user_id_course_id_pk` PRIMARY KEY(`user_id`,`course_id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(191) NOT NULL,
	`name` varchar(100),
	`note` text,
	`token_hash` varchar(255) NOT NULL,
	`status` enum('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
	`invited_by` int,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `instructor_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `instructor_invitations_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` int NOT NULL,
	`sub_module_id` int,
	`title` varchar(255) NOT NULL,
	`type` enum('materi','tugas','kuis','video','bacaan','audio','foto') NOT NULL DEFAULT 'materi',
	`duration` varchar(50),
	`content` text,
	`position` int NOT NULL,
	CONSTRAINT `materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`type` enum('materi','tugas','kuis') NOT NULL,
	`position` int NOT NULL,
	CONSTRAINT `modules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `progress` (
	`user_id` int NOT NULL,
	`material_id` int NOT NULL,
	`completed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `progress_user_id_material_id_pk` PRIMARY KEY(`user_id`,`material_id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`material_id` int NOT NULL,
	`score` int NOT NULL,
	`total` int,
	`correct` int,
	`pass_score` int NOT NULL DEFAULT 70,
	`attempted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sub_modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`position` int NOT NULL,
	CONSTRAINT `sub_modules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`material_id` int NOT NULL,
	`file_path` varchar(500) NOT NULL,
	`student_name` varchar(100),
	`student_nim` varchar(30),
	`note` text,
	`drive_file_id` varchar(255),
	`drive_link` varchar(500),
	`score` int,
	`feedback` text,
	`status` enum('submitted','reviewed','revision_requested') NOT NULL DEFAULT 'submitted',
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(191) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('student','teacher','admin') NOT NULL DEFAULT 'student',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `voucher_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`voucher_code` varchar(100) NOT NULL,
	`user_id` int NOT NULL,
	`course_id` int NOT NULL,
	`redeemed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voucher_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`code` varchar(100) NOT NULL,
	`course_id` int,
	`kind` enum('personal','umum') NOT NULL DEFAULT 'umum',
	`max_uses` int NOT NULL DEFAULT 1,
	`used_count` int NOT NULL DEFAULT 0,
	`assigned_user_id` int,
	`expires_at` timestamp,
	`status` enum('available','assigned','redeemed','expired') NOT NULL DEFAULT 'available',
	CONSTRAINT `vouchers_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE INDEX `instructor_invitations_email_idx` ON `instructor_invitations` (`email`);--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_module_id_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `course_instructors` ADD CONSTRAINT `course_instructors_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `course_instructors` ADD CONSTRAINT `course_instructors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `instructor_invitations` ADD CONSTRAINT `instructor_invitations_invited_by_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_module_id_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `materials` ADD CONSTRAINT `materials_sub_module_id_sub_modules_id_fk` FOREIGN KEY (`sub_module_id`) REFERENCES `sub_modules`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `modules` ADD CONSTRAINT `modules_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `progress` ADD CONSTRAINT `progress_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `progress` ADD CONSTRAINT `progress_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD CONSTRAINT `quiz_attempts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD CONSTRAINT `quiz_attempts_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `sub_modules` ADD CONSTRAINT `sub_modules_module_id_modules_id_fk` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `voucher_redemptions` ADD CONSTRAINT `voucher_redemptions_voucher_code_vouchers_code_fk` FOREIGN KEY (`voucher_code`) REFERENCES `vouchers`(`code`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `voucher_redemptions` ADD CONSTRAINT `voucher_redemptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `voucher_redemptions` ADD CONSTRAINT `voucher_redemptions_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_assigned_user_id_users_id_fk` FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;