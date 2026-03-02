ALTER TABLE `voices` ADD `sample_mode` text DEFAULT 'first' NOT NULL;--> statement-breakpoint
ALTER TABLE `voices` ADD `voice_volume` integer DEFAULT 100 NOT NULL;