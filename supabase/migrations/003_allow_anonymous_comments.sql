-- Allow anonymous comments (user_id can be null)

-- Drop old authenticated-only insert policy if it exists
DROP POLICY IF EXISTS "Auth insert comment" ON comments;

-- Allow anyone (authenticated or anonymous) to insert comments.
-- Authenticated users must use their own user_id; anonymous users must use null.
DROP POLICY IF EXISTS "Anon insert comment" ON comments;
CREATE POLICY "Anon insert comment" ON comments
  FOR INSERT
  WITH CHECK (
    user_id IS NULL
    OR auth.uid() = user_id
  );

-- Allow anyone to update report_count (for the report feature)
DROP POLICY IF EXISTS "Allow update report_count" ON comments;
CREATE POLICY "Allow update report_count" ON comments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
