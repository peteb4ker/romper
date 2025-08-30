CREATE INDEX `idx_banks_artist_search` ON `banks` (`artist`);--> statement-breakpoint
CREATE INDEX `idx_kits_name_search` ON `kits` (`name`);--> statement-breakpoint
CREATE INDEX `idx_kits_alias_search` ON `kits` (`alias`);--> statement-breakpoint
CREATE INDEX `idx_samples_filename_search` ON `samples` (`filename`);--> statement-breakpoint
CREATE INDEX `idx_samples_kit_name` ON `samples` (`kit_name`);