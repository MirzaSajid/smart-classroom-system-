ALTER TABLE `attendance_records` ADD `confidence` real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `student_dataset_student_id_unique` ON `student_dataset` (`student_id`);