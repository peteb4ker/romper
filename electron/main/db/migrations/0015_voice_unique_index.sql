-- A kit has one row per voice (#510). Nothing stopped a second row before,
-- so merge any duplicates first: keep the row that carries the most of the
-- user's settings (each setting that differs from its default counts once),
-- and the oldest row (lowest id) when that's a tie. No other table refers
-- to voices by id, so dropping the rest leaves nothing dangling.
DELETE FROM `voices` WHERE `id` NOT IN (
  SELECT `id` FROM (
    SELECT `id`, ROW_NUMBER() OVER (
      PARTITION BY `kit_name`, `voice_number`
      ORDER BY
        (COALESCE(`voice_alias`, '') != '')
        + (`stereo_choice` IS NOT NULL)
        + (`stereo_mode` != 0)
        + (`voice_volume` != 100)
        + (`sample_mode` != 'first')
        + (`slice_enabled` != 0)
        + (`slice_max_length` != 2)
        + (`slice_roll_amount` != 100)
        + (`slice_vary_length` != 0) DESC,
        `id` ASC
    ) AS `keep_rank`
    FROM `voices`
  ) WHERE `keep_rank` = 1
);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_voice` ON `voices` (`kit_name`,`voice_number`);
