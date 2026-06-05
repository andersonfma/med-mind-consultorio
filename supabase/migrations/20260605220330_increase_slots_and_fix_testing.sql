-- Increase slots for testing (was 5, now 100)
UPDATE profiles SET total_slots = 100;
ALTER TABLE profiles ALTER COLUMN total_slots SET DEFAULT 100;