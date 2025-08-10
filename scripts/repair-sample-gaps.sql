-- Database repair script to fix sample contiguity issues
-- This script will reindex all voices to remove gaps

-- Create a temporary table to hold the corrected sample data
CREATE TEMPORARY TABLE samples_corrected (
    id INTEGER,
    kit_name TEXT,
    voice_number INTEGER, 
    new_slot_number INTEGER,
    filename TEXT,
    source_path TEXT,
    is_stereo BOOLEAN
);

-- For each kit and voice combination, reassign slot numbers to be contiguous
WITH numbered_samples AS (
    SELECT 
        id,
        kit_name,
        voice_number,
        slot_number,
        filename,
        source_path,
        is_stereo,
        ROW_NUMBER() OVER (
            PARTITION BY kit_name, voice_number 
            ORDER BY slot_number
        ) as new_slot_number
    FROM samples
    ORDER BY kit_name, voice_number, slot_number
)
INSERT INTO samples_corrected (id, kit_name, voice_number, new_slot_number, filename, source_path, is_stereo)
SELECT id, kit_name, voice_number, new_slot_number, filename, source_path, is_stereo
FROM numbered_samples;

-- Update the original samples table with the corrected slot numbers
UPDATE samples 
SET slot_number = (
    SELECT new_slot_number 
    FROM samples_corrected 
    WHERE samples_corrected.id = samples.id
);

-- Verification: Check for any remaining gaps
SELECT 
    kit_name,
    voice_number,
    GROUP_CONCAT(slot_number) as slots,
    COUNT(*) as sample_count,
    MAX(slot_number) as max_slot,
    CASE 
        WHEN MAX(slot_number) = COUNT(*) THEN 'CONTIGUOUS ✓' 
        ELSE 'GAPS FOUND ❌' 
    END as status
FROM samples
GROUP BY kit_name, voice_number
HAVING status = 'GAPS FOUND ❌'
ORDER BY kit_name, voice_number;

-- Clean up
DROP TABLE samples_corrected;