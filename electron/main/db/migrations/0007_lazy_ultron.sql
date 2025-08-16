DROP INDEX `samples_kit_name_voice_number_slot_number_unique`;--> statement-breakpoint
DROP INDEX `samples_kit_name_voice_number_source_path_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_slot` ON `samples` (`kit_name`,`voice_number`,`slot_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_voice_source` ON `samples` (`kit_name`,`voice_number`,`source_path`);--> statement-breakpoint
ALTER TABLE `kits` ADD `bpm` integer DEFAULT 120 NOT NULL;