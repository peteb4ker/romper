-- Disable foreign key checks for the entire migration
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
-- Create banks table first
CREATE TABLE `banks` (
	`letter` text PRIMARY KEY NOT NULL,
	`artist` text,
	`rtf_filename` text,
	`scanned_at` integer
);
--> statement-breakpoint
-- Populate banks table with A-Z
INSERT INTO `banks` (`letter`, `artist`, `rtf_filename`, `scanned_at`) VALUES
('A', NULL, NULL, NULL),
('B', NULL, NULL, NULL),
('C', NULL, NULL, NULL),
('D', NULL, NULL, NULL),
('E', NULL, NULL, NULL),
('F', NULL, NULL, NULL),
('G', NULL, NULL, NULL),
('H', NULL, NULL, NULL),
('I', NULL, NULL, NULL),
('J', NULL, NULL, NULL),
('K', NULL, NULL, NULL),
('L', NULL, NULL, NULL),
('M', NULL, NULL, NULL),
('N', NULL, NULL, NULL),
('O', NULL, NULL, NULL),
('P', NULL, NULL, NULL),
('Q', NULL, NULL, NULL),
('R', NULL, NULL, NULL),
('S', NULL, NULL, NULL),
('T', NULL, NULL, NULL),
('U', NULL, NULL, NULL),
('V', NULL, NULL, NULL),
('W', NULL, NULL, NULL),
('X', NULL, NULL, NULL),
('Y', NULL, NULL, NULL),
('Z', NULL, NULL, NULL);
--> statement-breakpoint
-- Backup data from dependent tables
CREATE TEMPORARY TABLE temp_samples AS SELECT * FROM samples;
--> statement-breakpoint
CREATE TEMPORARY TABLE temp_voices AS SELECT * FROM voices;
--> statement-breakpoint
CREATE TEMPORARY TABLE temp_edit_actions AS SELECT * FROM edit_actions;
--> statement-breakpoint
-- Drop dependent tables first (in reverse dependency order)
DROP TABLE edit_actions;
--> statement-breakpoint
DROP TABLE samples;
--> statement-breakpoint
DROP TABLE voices;
--> statement-breakpoint
-- Create new kits table with bank_letter foreign key
CREATE TABLE `__new_kits` (
	`name` text PRIMARY KEY NOT NULL,
	`bank_letter` text,
	`alias` text,
	`artist` text,
	`editable` integer DEFAULT false NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`step_pattern` text,
	FOREIGN KEY (`bank_letter`) REFERENCES `banks`(`letter`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Copy data from old kits table to new table, populating bank_letter
INSERT INTO `__new_kits`("name", "bank_letter", "alias", "artist", "editable", "locked", "step_pattern") 
SELECT "name", SUBSTR("name", 1, 1), "alias", "artist", "editable", "locked", "step_pattern" FROM `kits`;
--> statement-breakpoint
-- Drop old kits table
DROP TABLE `kits`;
--> statement-breakpoint
-- Rename new table to kits
ALTER TABLE `__new_kits` RENAME TO `kits`;
--> statement-breakpoint
-- Recreate dependent tables with same structure
CREATE TABLE `voices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kit_name` text NOT NULL,
	`voice_number` integer NOT NULL,
	`voice_alias` text,
	FOREIGN KEY (`kit_name`) REFERENCES `kits`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `samples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kit_name` text NOT NULL,
	`filename` text NOT NULL,
	`voice_number` integer NOT NULL,
	`slot_number` integer NOT NULL,
	`source_path` text NOT NULL,
	`is_stereo` integer DEFAULT false NOT NULL,
	`wav_bitrate` integer,
	`wav_sample_rate` integer,
	FOREIGN KEY (`kit_name`) REFERENCES `kits`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `edit_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kit_name` text NOT NULL,
	`action_type` text NOT NULL,
	`action_data` text,
	`timestamp` integer NOT NULL,
	`sequence` integer NOT NULL,
	FOREIGN KEY (`kit_name`) REFERENCES `kits`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Restore data to dependent tables
INSERT INTO voices SELECT * FROM temp_voices;
--> statement-breakpoint
INSERT INTO samples SELECT * FROM temp_samples;
--> statement-breakpoint
INSERT INTO edit_actions SELECT * FROM temp_edit_actions;
--> statement-breakpoint
-- Clean up temporary tables
DROP TABLE temp_samples;
--> statement-breakpoint
DROP TABLE temp_voices;
--> statement-breakpoint
DROP TABLE temp_edit_actions;
--> statement-breakpoint
-- Re-enable foreign key checks
PRAGMA foreign_keys=ON;