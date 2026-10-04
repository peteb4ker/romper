ALTER TABLE `voices` ADD `stereo_choice` text;--> statement-breakpoint
-- Before #537 only the link button linked voices, so an existing link is
-- the user's choice: Romper never undoes it, and doesn't label it as
-- linked automatically
UPDATE `voices` SET `stereo_choice` = 'stereo' WHERE `stereo_mode` = 1;
