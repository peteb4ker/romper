ALTER TABLE `samples` ADD `wav_bit_depth` integer;--> statement-breakpoint
ALTER TABLE `samples` ADD `wav_channels` integer;--> statement-breakpoint
ALTER TABLE `voices` ADD `stereo_mode` integer DEFAULT false NOT NULL;