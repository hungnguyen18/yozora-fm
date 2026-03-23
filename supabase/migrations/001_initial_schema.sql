-- Core tables
CREATE TABLE artists (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_jp VARCHAR(255),
  image_url TEXT
);

CREATE TABLE animes (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  title_jp VARCHAR(255),
  year SMALLINT,
  season VARCHAR(10) CHECK (season IN ('winter', 'spring', 'summer', 'fall')),
  cover_url TEXT,
  anilist_id INT
);

CREATE TABLE songs (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  title_jp VARCHAR(255),
  artist_id BIGINT REFERENCES artists(id),
  anime_id BIGINT REFERENCES animes(id),
  type VARCHAR(4) NOT NULL CHECK (type IN ('OP', 'ED')),
  sequence SMALLINT DEFAULT 1,
  year SMALLINT NOT NULL,
  genre VARCHAR(50),
  animethemes_slug VARCHAR(255),
  spotify_uri VARCHAR(255),
  youtube_id VARCHAR(20),
  album_art_url TEXT,
  vote_count INT DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_songs_year ON songs(year);
CREATE INDEX idx_songs_artist_id ON songs(artist_id);
CREATE INDEX idx_songs_anime_id ON songs(anime_id);
CREATE INDEX idx_songs_genre ON songs(genre);

-- Community tables
CREATE TABLE votes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id BIGINT REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);

CREATE TABLE trivia (
  id BIGSERIAL PRIMARY KEY,
  song_id BIGINT REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content VARCHAR(500) NOT NULL,
  upvote_count INT DEFAULT 0,
  report_count INT DEFAULT 0,
  status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reported')),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trivia_song_id ON trivia(song_id);
CREATE INDEX idx_trivia_status ON trivia(status);

CREATE TABLE comments (
  id BIGSERIAL PRIMARY KEY,
  song_id BIGINT REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content VARCHAR(280) NOT NULL,
  report_count INT DEFAULT 0,
  status VARCHAR(10) DEFAULT 'visible' CHECK (status IN ('visible', 'reported')),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_song_id ON comments(song_id);

CREATE TABLE trivia_upvotes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trivia_id BIGINT REFERENCES trivia(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, trivia_id)
);

-- Vote count sync trigger
CREATE OR REPLACE FUNCTION update_song_vote_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE songs SET vote_count = vote_count + 1 WHERE id = NEW.song_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE songs SET vote_count = vote_count - 1 WHERE id = OLD.song_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vote_count
AFTER INSERT OR DELETE ON votes
FOR EACH ROW EXECUTE FUNCTION update_song_vote_count();

-- Trivia upvote count sync + auto-approve
CREATE OR REPLACE FUNCTION update_trivia_upvote_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE trivia SET upvote_count = upvote_count + 1,
      status = CASE WHEN upvote_count + 1 >= 3 AND status = 'pending' THEN 'approved' ELSE status END
    WHERE id = NEW.trivia_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE trivia SET upvote_count = upvote_count - 1 WHERE id = OLD.trivia_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trivia_upvote_count
AFTER INSERT OR DELETE ON trivia_upvotes
FOR EACH ROW EXECUTE FUNCTION update_trivia_upvote_count();
