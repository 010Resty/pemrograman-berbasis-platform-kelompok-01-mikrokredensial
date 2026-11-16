CREATE TABLE `course_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(100) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `course_categories_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `course_categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `course_categories_active_sort_idx` ON `course_categories` (`is_active`,`sort_order`,`id`);--> statement-breakpoint
INSERT INTO `course_categories` (`slug`, `name`, `sort_order`) VALUES
	('pengembangan-web', 'Pengembangan Web', 10),
	('basis-data', 'Basis Data', 20),
	('jaringan', 'Jaringan', 30),
	('keamanan', 'Keamanan', 40),
	('ai-data', 'AI & Data', 50),
	('infrastruktur', 'Infrastruktur', 60),
	('desain', 'Desain', 70),
	('bisnis', 'Bisnis', 80);
