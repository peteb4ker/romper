-- Clean up duplicate samples before creating unique indexes
-- Remove duplicate samples with same kit_name, voice_number, slot_number (keep lowest id)
DELETE FROM samples 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM samples 
  GROUP BY kit_name, voice_number, slot_number
);--> statement-breakpoint

-- Remove duplicate samples with same kit_name, voice_number, source_path (keep lowest id)
DELETE FROM samples 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM samples 
  GROUP BY kit_name, voice_number, source_path
);--> statement-breakpoint

-- Now create unique indexes on cleaned data
CREATE UNIQUE INDEX `samples_kit_name_voice_number_slot_number_unique` ON `samples` (`kit_name`,`voice_number`,`slot_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `samples_kit_name_voice_number_source_path_unique` ON `samples` (`kit_name`,`voice_number`,`source_path`);