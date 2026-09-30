ALTER TABLE `kits` ADD `slice_steps` text;--> statement-breakpoint
ALTER TABLE `kits` ADD `slicer_division` integer DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE `voices` ADD `slice_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `voices` ADD `slice_max_length` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `voices` ADD `slice_roll_amount` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `voices` ADD `slice_vary_length` integer DEFAULT false NOT NULL;
