-- SQL fixture to initialize Romper database for E2E tests
-- This corresponds to the audio files in tests/fixtures/sdcard/
-- 
-- File structure:
-- A0/1_kick.wav, A0/2_snare.wav
-- B1/1_kick.wav, B1/2_snare.wav

-- Insert banks
INSERT INTO banks (letter, artist, rtf_filename, scanned_at) VALUES
('A', 'Test Artist A', 'A_TestArtistA.rtf', 1640995200), -- Jan 1, 2022
('B', 'Test Artist B', 'B_TestArtistB.rtf', 1640995200);

-- Insert kits
INSERT INTO kits (name, bank_letter, alias, editable, is_favorite, locked, modified_since_sync, step_pattern) VALUES
('A0', 'A', 'Test Kit A0', 0, 0, 0, 0, NULL),
('B1', 'B', 'Test Kit B1', 0, 0, 0, 0, NULL);

-- Insert voices (4 voices per kit)
INSERT INTO voices (kit_name, voice_number, voice_alias) VALUES
-- Kit A0 voices
('A0', 1, 'Kick'),
('A0', 2, 'Snare'),
('A0', 3, 'Hi-Hat'),
('A0', 4, 'Cymbal'),
-- Kit B1 voices  
('B1', 1, 'Kick'),
('B1', 2, 'Snare'),
('B1', 3, 'Hi-Hat'),
('B1', 4, 'Cymbal');

-- Insert samples (corresponding to actual audio files in fixtures)
INSERT INTO samples (kit_name, voice_number, slot_number, filename, source_path, is_stereo, wav_sample_rate, wav_bitrate) VALUES
-- Kit A0 samples
('A0', 1, 0, '1_kick.wav', '/FIXTURE_PATH/A0/1_kick.wav', 0, 44100, 16),
('A0', 2, 0, '2_snare.wav', '/FIXTURE_PATH/A0/2_snare.wav', 0, 44100, 16),
-- Kit B1 samples
('B1', 1, 0, '1_kick.wav', '/FIXTURE_PATH/B1/1_kick.wav', 0, 44100, 16),
('B1', 2, 0, '2_snare.wav', '/FIXTURE_PATH/B1/2_snare.wav', 0, 44100, 16);