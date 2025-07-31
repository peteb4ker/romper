ALTER TABLE `edit_actions` ADD `sequence_number` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `edit_actions` ADD `undone_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `edit_actions_kit_name_sequence_number_unique` ON `edit_actions` (`kit_name`,`sequence_number`);--> statement-breakpoint
ALTER TABLE `edit_actions` DROP COLUMN `sequence`;