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
CREATE TABLE `kits` (
	`name` text PRIMARY KEY NOT NULL,
	`alias` text,
	`artist` text,
	`editable` integer DEFAULT false NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`step_pattern` text
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
CREATE TABLE `voices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kit_name` text NOT NULL,
	`voice_number` integer NOT NULL,
	`voice_alias` text,
	FOREIGN KEY (`kit_name`) REFERENCES `kits`(`name`) ON UPDATE no action ON DELETE no action
);
