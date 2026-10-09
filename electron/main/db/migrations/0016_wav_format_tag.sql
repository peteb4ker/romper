-- The fmt chunk's format tag (#576): 1 PCM, 3 float, 0xFFFE extensible.
-- Null for existing samples until their header is read again: a scan, or
-- the check when their kit opens.
ALTER TABLE `samples` ADD `wav_format_tag` integer;
