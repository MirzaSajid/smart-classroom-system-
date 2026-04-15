CREATE TABLE `attendance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` text NOT NULL,
	`class_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`method` text NOT NULL,
	`marked_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_student_class_date_unique` ON `attendance_records` (`student_id`,`class_id`,`date`);--> statement-breakpoint
CREATE TABLE `cameras` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`class_id` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`install_date` text NOT NULL,
	`model` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`class_teacher` text NOT NULL,
	`total_students` integer DEFAULT 0 NOT NULL,
	`day` text,
	`start_time` text,
	`end_time` text
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`class_id` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sections_class_id_name_unique` ON `sections` (`class_id`,`name`);--> statement-breakpoint
CREATE TABLE `student_dataset` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`image_data` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`embedding_json` text
);
--> statement-breakpoint
CREATE TABLE `student_enrollments` (
	`student_id` text NOT NULL,
	`class_id` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_enrollments_unique` ON `student_enrollments` (`student_id`,`class_id`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`roll_number` text,
	`parent_contact` text
);
