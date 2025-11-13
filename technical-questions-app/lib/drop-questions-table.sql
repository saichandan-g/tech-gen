-- Drop the existing questions table
DROP TABLE IF EXISTS public.questions;

-- Verify only mcq_questions table remains
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
