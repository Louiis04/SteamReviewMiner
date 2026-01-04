const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "steamuser",
  password: process.env.DB_PASSWORD || "steampass123",
  database: process.env.DB_NAME || "steamreviews",
});

pool.on("connect", () => {
  console.log("✅ Conectado ao PostgreSQL");
});

pool.on("error", (err) => {
  console.error("❌ Erro no PostgreSQL:", err);
});

async function getGame(appId) {
  const query = "SELECT * FROM games WHERE app_id = $1";
  const result = await pool.query(query, [appId]);
  return result.rows[0];
}

async function saveGame(appId, gameData) {
  const query = `
        INSERT INTO games (app_id, name, short_description, header_image, developers, publishers, price_overview, release_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (app_id) 
        DO UPDATE SET 
            name = EXCLUDED.name,
            short_description = EXCLUDED.short_description,
            header_image = EXCLUDED.header_image,
            developers = EXCLUDED.developers,
            publishers = EXCLUDED.publishers,
            price_overview = EXCLUDED.price_overview,
            release_date = EXCLUDED.release_date,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `;

  const values = [
    appId,
    gameData.name || `Game ${appId}`,
    gameData.short_description || null,
    gameData.header_image || null,
    gameData.developers ? gameData.developers.join(", ") : null,
    gameData.publishers ? gameData.publishers.join(", ") : null,
    gameData.price_overview ? JSON.stringify(gameData.price_overview) : null,
    gameData.release_date ? JSON.stringify(gameData.release_date) : null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getReviewStats(appId) {
  const query = "SELECT * FROM review_stats WHERE app_id = $1";
  const result = await pool.query(query, [appId]);
  return result.rows[0];
}

async function saveReviewStats(appId, reviewData) {
  const query = `
        INSERT INTO review_stats (app_id, total_reviews, total_positive, total_negative, review_score, review_score_desc)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (app_id) 
        DO UPDATE SET 
            total_reviews = EXCLUDED.total_reviews,
            total_positive = EXCLUDED.total_positive,
            total_negative = EXCLUDED.total_negative,
            review_score = EXCLUDED.review_score,
            review_score_desc = EXCLUDED.review_score_desc,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `;

  const values = [
    appId,
    reviewData.total_reviews || 0,
    reviewData.total_positive || 0,
    reviewData.total_negative || 0,
    reviewData.review_score || 0,
    reviewData.review_score_desc || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function isReviewStatsExpired(appId) {
  const cacheHours = parseInt(process.env.CACHE_EXPIRATION_HOURS || 24);
  const query = `
        SELECT updated_at,
               EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - updated_at))/3600 as hours_ago
        FROM review_stats 
        WHERE app_id = $1
    `;
  const result = await pool.query(query, [appId]);

  if (result.rows.length === 0) {
    return true;
  }

  const hoursAgo = parseFloat(result.rows[0].hours_ago);
  return hoursAgo > cacheHours;
}

async function getComments(appId, limit = 10, offset = 0, filters = {}) {
  let query = `SELECT * FROM comments WHERE app_id = $1`;
  const values = [appId];
  let paramCount = 2;

  if (filters.sentiment) {
    if (filters.sentiment === "positive") {
      query += ` AND voted_up = true`;
    } else if (filters.sentiment === "negative") {
      query += ` AND voted_up = false`;
    }
  }

  if (filters.minPlaytime) {
    query += ` AND (author_playtime_forever / 60) >= $${paramCount}`;
    values.push(filters.minPlaytime);
    paramCount++;
  }

  if (filters.minVotesUp) {
    query += ` AND votes_up >= $${paramCount}`;
    values.push(filters.minVotesUp);
    paramCount++;
  }

  if (filters.minUtilityScore) {
    query += ` AND weighted_vote_score >= $${paramCount}`;
    values.push(filters.minUtilityScore / 10);
  }

  if (filters.minTextLength) {
    query += ` AND LENGTH(review) >= $${paramCount}`;
    values.push(filters.minTextLength);
    paramCount++;
  }

  if (filters.dateOrder) {
    if (filters.dateOrder === "oldest") {
      query += ` ORDER BY timestamp_created ASC`;
    } else {
      query += ` ORDER BY timestamp_created DESC`;
    }
  } else {
    query += ` ORDER BY timestamp_created DESC`;
  }

  query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows;
}

async function getCommentsCount(appId, filters = {}) {
  let query = "SELECT COUNT(*) as total FROM comments WHERE app_id = $1";
  const values = [appId];
  let paramCount = 2;

  if (filters.sentiment) {
    if (filters.sentiment === "positive") {
      query += ` AND voted_up = true`;
    } else if (filters.sentiment === "negative") {
      query += ` AND voted_up = false`;
    }
  }

  if (filters.minPlaytime) {
    query += ` AND (author_playtime_forever / 60) >= $${paramCount}`;
    values.push(filters.minPlaytime);
    paramCount++;
  }

  if (filters.minVotesUp) {
    query += ` AND votes_up >= $${paramCount}`;
    values.push(filters.minVotesUp);
    paramCount++;
  }

  if (filters.minTextLength) {
    query += ` AND LENGTH(review) >= $${paramCount}`;
    values.push(filters.minTextLength);
    paramCount++;
  }

  const result = await pool.query(query, values);
  return parseInt(result.rows[0].total);
}

async function saveComments(appId, comments) {
  if (!comments || comments.length === 0) return 0;

  const client = await pool.connect();
  let savedCount = 0;

  try {
    await client.query("BEGIN");

    for (const comment of comments) {
      const query = `
                INSERT INTO comments (
                    app_id, recommendationid, author_steamid, 
                    author_playtime_forever, author_playtime_last_two_weeks,
                    voted_up, votes_up, votes_down, votes_funny,
                    weighted_vote_score, comment_count, steam_purchase,
                    received_for_free, written_during_early_access,
                    review, timestamp_created, timestamp_updated, language
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                ON CONFLICT (recommendationid) DO NOTHING
            `;

      const values = [
        appId,
        comment.recommendationid,
        comment.author?.steamid || null,
        comment.author?.playtime_forever || 0,
        comment.author?.playtime_at_review_time || 0,
        comment.voted_up || false,
        comment.votes_up || 0,
        comment.votes_down || 0,
        comment.votes_funny || 0,
        comment.weighted_vote_score || 0,
        comment.comment_count || 0,
        comment.steam_purchase || false,
        comment.received_for_free || false,
        comment.written_during_early_access || false,
        comment.review || "",
        comment.timestamp_created || 0,
        comment.timestamp_updated || 0,
        comment.language || "unknown",
      ];

      const result = await client.query(query, values);
      if (result.rowCount > 0) savedCount++;
    }

    await client.query("COMMIT");
    return savedCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function areCommentsExpired(appId) {
  const cacheHours = parseInt(process.env.CACHE_EXPIRATION_HOURS || 24);
  const query = `
        SELECT MAX(created_at) as last_created,
               EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(created_at)))/3600 as hours_ago
        FROM comments 
        WHERE app_id = $1
    `;
  const result = await pool.query(query, [appId]);

  if (result.rows.length === 0 || !result.rows[0].last_created) {
    return true;
  }

  const hoursAgo = parseFloat(result.rows[0].hours_ago);
  return hoursAgo > cacheHours;
}

async function getCompleteGameData(
  appId,
  commentsLimit = 10,
  commentsOffset = 0
) {
  const game = await getGame(appId);
  const reviewStats = await getReviewStats(appId);
  const comments = await getComments(appId, commentsLimit, commentsOffset);
  const commentsTotal = await getCommentsCount(appId);

  return {
    game,
    reviewStats,
    comments,
    commentsTotal,
    fromCache: true,
  };
}

async function needsUpdate(appId) {
  const game = await getGame(appId);

  if (!game) {
    return true;
  }

  const reviewExpired = await isReviewStatsExpired(appId);
  const commentsExpired = await areCommentsExpired(appId);

  return reviewExpired || commentsExpired;
}

async function healthCheck() {
  try {
    const result = await pool.query("SELECT NOW()");
    return { healthy: true, timestamp: result.rows[0].now };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

async function searchGamesByName(searchTerm, limit = 10) {
  const query = `
        SELECT app_id, name, header_image
        FROM games
        WHERE LOWER(name) LIKE LOWER($1)
        ORDER BY 
            CASE 
                WHEN LOWER(name) = LOWER($2) THEN 0
                WHEN LOWER(name) LIKE LOWER($3) THEN 1
                ELSE 2
            END,
            name
        LIMIT $4
    `;

  const searchPattern = `%${searchTerm}%`;
  const exactMatch = searchTerm;
  const startsWithPattern = `${searchTerm}%`;

  const result = await pool.query(query, [
    searchPattern,
    exactMatch,
    startsWithPattern,
    limit,
  ]);
  return result.rows;
}

async function saveSearchCache(searchTerm, games) {
  if (!games || games.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const game of games) {
      const query = `
                INSERT INTO game_search_cache (search_term, app_id, name, header_image)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (search_term, app_id) DO NOTHING
            `;
      await client.query(query, [
        searchTerm.toLowerCase(),
        game.appid,
        game.name,
        game.header_image,
      ]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getSearchCache(searchTerm, limit = 10) {
  const query = `
        SELECT DISTINCT ON (app_id) app_id, name, header_image
        FROM game_search_cache
        WHERE LOWER(search_term) LIKE LOWER($1)
        ORDER BY app_id, created_at DESC
        LIMIT $2
    `;

  const searchPattern = `%${searchTerm}%`;
  const result = await pool.query(query, [searchPattern, limit]);
  return result.rows;
}
async function getTopRatedGames(
  limit = 50,
  minReviews = 100,
  sortBy = "rating"
) {
  let orderBy;

  switch (sortBy) {
    case "reviews":
      orderBy = "rs.total_reviews DESC";
      break;
    case "recent":
      orderBy = "g.updated_at DESC";
      break;
    case "rating":
    default:
      orderBy = "rs.review_score DESC, rs.total_positive DESC";
      break;
  }

  const query = `
        SELECT 
            g.app_id,
            g.name,
            g.short_description,
            g.header_image,
            g.developers,
            g.publishers,
            rs.total_reviews,
            rs.total_positive,
            rs.total_negative,
            rs.review_score,
            rs.review_score_desc,
            CAST(ROUND(CAST(rs.total_positive AS NUMERIC) / NULLIF(rs.total_reviews, 0) * 100, 1) AS NUMERIC) as positive_percentage,
            rs.updated_at as stats_updated_at
        FROM games g
        INNER JOIN review_stats rs ON g.app_id = rs.app_id
        WHERE rs.total_reviews >= $1
        ORDER BY ${orderBy}
        LIMIT $2
    `;

  const result = await pool.query(query, [minReviews, limit]);
  return result.rows;
}

async function searchGamesByKeywords(keywords, limit = 20, minMatches = 1) {
  if (!keywords || keywords.length === 0) {
    return [];
  }

  const keywordList = keywords
    .map((kw) => kw.trim().toLowerCase())
    .filter((kw) => kw.length > 0);

  if (keywordList.length === 0) {
    return [];
  }

  const tsQuery = keywordList.join(" | ");

  const query = `
        WITH keyword_matches AS (
            SELECT 
                c.app_id,
                COUNT(DISTINCT c.id) as comment_matches,
                -- Calcula a média do Score de Utilidade (Aproximação SQL da fórmula JS)
                AVG(
                    10 * (1 - exp( -0.15 * (
                        (2.0 + (c.votes_up * 0.5) + (c.votes_funny * 0.1) + (LENGTH(c.review) * 0.002)) * 
                        (1 + LOG(1 + (COALESCE(c.author_playtime_forever, 0) / 60.0)) * 0.1)
                    )))
                ) as avg_utility_score
            FROM comments c
            WHERE to_tsvector('simple', c.review) @@ to_tsquery('simple', $1)
            GROUP BY c.app_id
            HAVING COUNT(DISTINCT c.id) >= $2
        )
        SELECT 
            g.app_id,
            g.name,
            g.short_description,
            g.header_image,
            g.developers,
            g.publishers,
            rs.total_reviews,
            rs.total_positive,
            rs.total_negative,
            rs.review_score,
            rs.review_score_desc,
            CAST(ROUND(CAST(rs.total_positive AS NUMERIC) / NULLIF(rs.total_reviews, 0) * 100, 1) AS NUMERIC) as positive_percentage,
            km.comment_matches,
            ROUND(CAST(km.avg_utility_score AS NUMERIC), 2) as relevance_score
        FROM keyword_matches km
        INNER JOIN games g ON g.app_id = km.app_id
        LEFT JOIN review_stats rs ON rs.app_id = g.app_id
        ORDER BY relevance_score DESC, rs.total_reviews DESC
        LIMIT $3
    `;

  const result = await pool.query(query, [tsQuery, minMatches, limit]);
  return result.rows;
}

async function getCommentsWithKeywords(appId, keywords, limit = 10) {
  if (!keywords || keywords.length === 0) {
    return [];
  }

  const keywordList = keywords
    .map((kw) => kw.trim().toLowerCase())
    .filter((kw) => kw.length > 0);

  if (keywordList.length === 0) {
    return [];
  }

  const tsQuery = keywordList.join(" | ");

  const query = `
        SELECT 
            c.id,
            c.app_id,
            c.recommendationid,
            c.author_steamid,
            c.author_playtime_forever,
            c.author_playtime_last_two_weeks,
            c.voted_up,
            c.votes_up,
            c.votes_down,
            c.votes_funny,
            c.weighted_vote_score,
            c.comment_count,
            c.steam_purchase,
            c.received_for_free,
            c.written_during_early_access,
            c.review,
            c.timestamp_created,
            c.timestamp_updated,
            c.language,
            c.created_at,
            -- Calcular relevância do comentário
            (c.votes_up * 2 + c.votes_funny) as comment_relevance
        FROM comments c
        WHERE c.app_id = $1
        AND to_tsvector('simple', c.review) @@ to_tsquery('simple', $2)
        ORDER BY comment_relevance DESC, c.timestamp_created DESC
        LIMIT $3
    `;

  const result = await pool.query(query, [appId, tsQuery, limit]);
  return result.rows;
}

module.exports = {
  pool,
  getGame,
  saveGame,
  getReviewStats,
  saveReviewStats,
  isReviewStatsExpired,
  getComments,
  getCommentsCount,
  saveComments,
  areCommentsExpired,
  getCompleteGameData,
  needsUpdate,
  healthCheck,
  searchGamesByName,
  saveSearchCache,
  getSearchCache,
  getTopRatedGames,
  searchGamesByKeywords,
  getCommentsWithKeywords,
};
