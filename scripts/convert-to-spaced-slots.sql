-- Migration: Convert contiguous slot numbers to spaced slot numbers
-- This eliminates the need for temporary slots during moves

-- Create a backup table first (safety measure)
CREATE TABLE samples_backup AS SELECT * FROM samples;

-- Convert each voice separately to ensure proper ordering
UPDATE samples 
SET slot_number = (
    (SELECT COUNT(*) 
     FROM samples s2 
     WHERE s2.kit_name = samples.kit_name 
       AND s2.voice_number = samples.voice_number 
       AND s2.slot_number < samples.slot_number
    ) + 1
) * 100
WHERE 1=1;

-- Verification query to check the conversion
SELECT 
    kit_name,
    voice_number,
    COUNT(*) as sample_count,
    MIN(slot_number) as min_slot,
    MAX(slot_number) as max_slot,
    GROUP_CONCAT(slot_number ORDER BY slot_number) as all_slots
FROM samples
GROUP BY kit_name, voice_number
ORDER BY kit_name, voice_number
LIMIT 10;