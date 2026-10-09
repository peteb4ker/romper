-- The file's size and modification time when its header was last read
-- (#793), so a file changed on disk is read again. Null for existing
-- samples until then: the check when their kit opens, or a scan, reads
-- their header once more and records both.
ALTER TABLE `samples` ADD `source_mtime_ms` integer;--> statement-breakpoint
ALTER TABLE `samples` ADD `source_size` integer;
