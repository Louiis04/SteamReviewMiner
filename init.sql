CREATE TABLE IF NOT EXISTS games (
    app_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    short_description TEXT,
    header_image TEXT,
    developers TEXT,
    publishers TEXT,
    price_overview JSONB,
    release_date JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_stats (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(20) NOT NULL REFERENCES games(app_id) ON DELETE CASCADE,
    total_reviews INTEGER DEFAULT 0,
    total_positive INTEGER DEFAULT 0,
    total_negative INTEGER DEFAULT 0,
    review_score INTEGER DEFAULT 0,
    review_score_desc VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(app_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(20) NOT NULL REFERENCES games(app_id) ON DELETE CASCADE,
    recommendationid VARCHAR(50) UNIQUE NOT NULL,
    author_steamid VARCHAR(50),
    author_playtime_forever INTEGER,
    author_playtime_last_two_weeks INTEGER,
    voted_up BOOLEAN,
    votes_up INTEGER DEFAULT 0,
    votes_down INTEGER DEFAULT 0,
    votes_funny INTEGER DEFAULT 0,
    weighted_vote_score NUMERIC(5,2),
    comment_count INTEGER DEFAULT 0,
    steam_purchase BOOLEAN,
    received_for_free BOOLEAN,
    written_during_early_access BOOLEAN,
    review TEXT,
    timestamp_created BIGINT,
    timestamp_updated BIGINT,
    language VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_search_cache (
    id SERIAL PRIMARY KEY,
    search_term VARCHAR(255) NOT NULL,
    app_id VARCHAR(20) NOT NULL,
    name VARCHAR(500) NOT NULL,
    header_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(search_term, app_id)
);

CREATE INDEX IF NOT EXISTS idx_comments_app_id ON comments(app_id);
CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON comments(timestamp_created DESC);
CREATE INDEX IF NOT EXISTS idx_review_stats_app_id ON review_stats(app_id);
CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
CREATE INDEX IF NOT EXISTS idx_games_name_lower ON games(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_search_cache_term ON game_search_cache(LOWER(search_term));

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_stats_updated_at BEFORE UPDATE ON review_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE games IS 'Armazena informações básicas dos jogos da Steam';
COMMENT ON TABLE review_stats IS 'Armazena estatísticas agregadas de reviews dos jogos';
COMMENT ON TABLE comments IS 'Armazena reviews/comentários individuais dos usuários';
