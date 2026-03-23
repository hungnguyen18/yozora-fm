-- Enable RLS on all tables
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE animes ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivia_upvotes ENABLE ROW LEVEL SECURITY;

-- Core tables: public read
CREATE POLICY "Public read artists" ON artists FOR SELECT USING (true);
CREATE POLICY "Public read animes" ON animes FOR SELECT USING (true);
CREATE POLICY "Public read songs" ON songs FOR SELECT USING (true);

-- Votes: authenticated insert/delete own, public read
CREATE POLICY "Public read votes" ON votes FOR SELECT USING (true);
CREATE POLICY "Auth insert vote" ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth delete own vote" ON votes FOR DELETE USING (auth.uid() = user_id);

-- Trivia: public read approved only, authenticated insert
CREATE POLICY "Public read approved trivia" ON trivia FOR SELECT USING (status = 'approved');
CREATE POLICY "Auth insert trivia" ON trivia FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comments: public read visible only, authenticated insert/delete own
CREATE POLICY "Public read visible comments" ON comments FOR SELECT USING (status = 'visible');
CREATE POLICY "Auth insert comment" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth delete own comment" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Trivia upvotes: authenticated insert/delete own, public read
CREATE POLICY "Public read trivia_upvotes" ON trivia_upvotes FOR SELECT USING (true);
CREATE POLICY "Auth insert trivia_upvote" ON trivia_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth delete own trivia_upvote" ON trivia_upvotes FOR DELETE USING (auth.uid() = user_id);
