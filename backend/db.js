const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'steamuser',
    password: process.env.DB_PASSWORD || 'steampass123',
    database: process.env.DB_NAME || 'steamreviews',
});

pool.on('connect', () => {
    console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Erro no PostgreSQL:', err);
});

async function getGame(appId) {
    const query = 'SELECT * FROM games WHERE app_id = $1';
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
        gameData.developers ? gameData.developers.join(', ') : null,
        gameData.publishers ? gameData.publishers.join(', ') : null,
        gameData.price_overview ? JSON.stringify(gameData.price_overview) : null,
        gameData.release_date ? JSON.stringify(gameData.release_date) : null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
}

async function getReviewStats(appId) {
    const query = 'SELECT * FROM review_stats WHERE app_id = $1';
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

async function getComments(appId, limit = 10, offset = 0, language = 'all') {
    const normalizedLanguage = (language || 'all').toLowerCase();
    const params = [appId];
    let whereClause = 'app_id = $1';

    if (normalizedLanguage !== 'all') {
        params.push(normalizedLanguage);
        whereClause += ` AND LOWER(COALESCE(language, 'unknown')) = $${params.length}`;
    }

    params.push(limit);
    params.push(offset);

    const query = `
        SELECT * FROM comments 
        WHERE ${whereClause}
        ORDER BY timestamp_created DESC 
        LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(query, params);
    return result.rows;
}

async function getCommentsCount(appId, language = 'all') {
    const normalizedLanguage = (language || 'all').toLowerCase();
    let query = 'SELECT COUNT(*) as total FROM comments WHERE app_id = $1';
    const params = [appId];

    if (normalizedLanguage !== 'all') {
        params.push(normalizedLanguage);
        query += ` AND LOWER(COALESCE(language, 'unknown')) = $${params.length}`;
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].total);
}

async function getCommentLanguageStats(appId) {
    const query = `
        SELECT LOWER(COALESCE(language, 'unknown')) AS language, COUNT(*) AS total
        FROM comments
        WHERE app_id = $1
        GROUP BY LOWER(COALESCE(language, 'unknown'))
        ORDER BY COUNT(*) DESC
    `;

    const result = await pool.query(query, [appId]);
    return result.rows.map((row) => ({
        language: row.language || 'unknown',
        total: parseInt(row.total, 10) || 0,
    }));
}

async function saveComments(appId, comments) {
    if (!comments || comments.length === 0) return 0;

    const client = await pool.connect();
    let savedCount = 0;

    try {
        await client.query('BEGIN');

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
                comment.review || '',
                comment.timestamp_created || 0,
                comment.timestamp_updated || 0,
                (typeof comment.language === 'string' && comment.language.trim().length > 0
                    ? comment.language.toLowerCase()
                    : 'unknown'),
            ];

            const result = await client.query(query, values);
            if (result.rowCount > 0) savedCount++;
        }

        await client.query('COMMIT');
        return savedCount;
    } catch (error) {
        await client.query('ROLLBACK');
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

async function getCompleteGameData(appId, commentsLimit = 10, commentsOffset = 0) {
    const game = await getGame(appId);
    const reviewStats = await getReviewStats(appId);
    const comments = await getComments(appId, commentsLimit, commentsOffset);
    const commentsTotal = await getCommentsCount(appId);

    return {
        game,
        reviewStats,
        comments,
        commentsTotal,
        fromCache: true
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
        const result = await pool.query('SELECT NOW()');
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
    
    const result = await pool.query(query, [searchPattern, exactMatch, startsWithPattern, limit]);
    return result.rows;
}

async function saveSearchCache(searchTerm, games) {
    if (!games || games.length === 0) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

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
                game.header_image
            ]);
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
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

async function getOverviewMetrics() {
    const aggregateQuery = `
        SELECT
            (SELECT COUNT(*) FROM games) AS total_games,
            (SELECT COUNT(*) FROM review_stats) AS total_review_stats,
            (SELECT COUNT(*) FROM comments) AS total_comments,
            (SELECT COUNT(*) FROM game_search_cache) AS cached_search_entries,
            (SELECT COUNT(DISTINCT search_term) FROM game_search_cache) AS cached_search_terms,
            (SELECT COALESCE(SUM(total_reviews), 0) FROM review_stats) AS indexed_reviews,
            (SELECT COALESCE(SUM(total_positive), 0) FROM review_stats) AS indexed_positive_reviews,
            (SELECT MAX(updated_at) FROM review_stats) AS last_stats_sync,
            (SELECT MAX(created_at) FROM comments) AS last_comment_ingested
    `;

    const aggregateResult = await pool.query(aggregateQuery);
    const statsRow = aggregateResult.rows[0] || {};

    const recentUpdatesQuery = `
        SELECT 
            g.app_id,
            g.name,
            rs.total_reviews,
            rs.total_positive,
            rs.total_negative,
            rs.review_score_desc,
            rs.updated_at
        FROM games g
        INNER JOIN review_stats rs ON g.app_id = rs.app_id
        ORDER BY rs.updated_at DESC NULLS LAST
        LIMIT 5
    `;

    const recentUpdatesResult = await pool.query(recentUpdatesQuery);

    const normalizeInt = (value) => (value ? parseInt(value, 10) : 0);
    const normalizeNumber = (value) => (value ? Number(value) : 0);

    return {
        stats: {
            totalGames: normalizeInt(statsRow.total_games),
            totalReviewStats: normalizeInt(statsRow.total_review_stats),
            totalComments: normalizeInt(statsRow.total_comments),
            cachedSearchEntries: normalizeInt(statsRow.cached_search_entries),
            cachedSearchTerms: normalizeInt(statsRow.cached_search_terms),
            indexedReviews: normalizeNumber(statsRow.indexed_reviews),
            indexedPositiveReviews: normalizeNumber(statsRow.indexed_positive_reviews),
            lastStatsSync: statsRow.last_stats_sync,
            lastCommentIngested: statsRow.last_comment_ingested,
        },
        recentUpdates: recentUpdatesResult.rows.map((row) => ({
            app_id: row.app_id,
            name: row.name,
            total_reviews: row.total_reviews,
            total_positive: row.total_positive,
            total_negative: row.total_negative,
            review_score_desc: row.review_score_desc,
            updated_at: row.updated_at,
        })),
    };
}

async function getJobQueueMetrics() {
    const cacheHours = parseInt(process.env.CACHE_EXPIRATION_HOURS || 24, 10);
    const intervalParam = cacheHours.toString();

    const aggregateQuery = `
        SELECT
            (SELECT COUNT(*) FROM games) AS total_games,
            (SELECT COUNT(*) FROM review_stats) AS total_review_stats,
            (SELECT COUNT(*) FROM games g LEFT JOIN review_stats rs ON g.app_id = rs.app_id WHERE rs.app_id IS NULL) AS games_missing_stats,
            (SELECT COUNT(*) FROM review_stats WHERE updated_at IS NULL OR updated_at < NOW() - ($1 || ' hours')::interval) AS stale_review_stats,
            (SELECT COUNT(*) FROM comments) AS total_comments,
            (SELECT COUNT(*) FROM (
                SELECT app_id, MAX(created_at) AS last_created
                FROM comments
                GROUP BY app_id
            ) AS sub WHERE last_created IS NULL OR last_created < NOW() - ($1 || ' hours')::interval) AS stale_comment_games,
            (SELECT COUNT(*) FROM comments WHERE created_at >= NOW() - INTERVAL '24 hours') AS comments_last_24h,
            (SELECT COUNT(*) FROM review_stats WHERE updated_at >= NOW() - INTERVAL '24 hours') AS review_stats_last_24h,
            (SELECT MAX(created_at) FROM game_search_cache) AS last_search_cache_entry,
            (SELECT COUNT(DISTINCT search_term) FROM game_search_cache) AS cached_terms
    `;

    const aggregateResult = await pool.query(aggregateQuery, [intervalParam]);
    const row = aggregateResult.rows[0] || {};

    const staleReviewsQuery = `
        SELECT g.app_id, g.name, rs.updated_at
        FROM games g
        LEFT JOIN review_stats rs ON g.app_id = rs.app_id
        WHERE rs.updated_at IS NULL OR rs.updated_at < NOW() - ($1 || ' hours')::interval
        ORDER BY rs.updated_at NULLS FIRST
        LIMIT 5
    `;
    const staleReviewRows = await pool.query(staleReviewsQuery, [intervalParam]);

    const staleCommentsQuery = `
        SELECT g.app_id, g.name, MAX(c.created_at) AS last_comment
        FROM games g
        LEFT JOIN comments c ON g.app_id = c.app_id
        GROUP BY g.app_id, g.name
        HAVING MAX(c.created_at) IS NULL OR MAX(c.created_at) < NOW() - ($1 || ' hours')::interval
        ORDER BY MAX(c.created_at) NULLS FIRST
        LIMIT 5
    `;
    const staleCommentRows = await pool.query(staleCommentsQuery, [intervalParam]);

    const totalGames = parseInt(row.total_games || 0, 10);
    const totalReviewStats = parseInt(row.total_review_stats || 0, 10);
    const gamesMissingStats = parseInt(row.games_missing_stats || 0, 10);
    const staleReviewStats = parseInt(row.stale_review_stats || 0, 10);
    const totalComments = parseInt(row.total_comments || 0, 10);
    const staleCommentGames = parseInt(row.stale_comment_games || 0, 10);
    const commentsLast24h = parseInt(row.comments_last_24h || 0, 10);
    const reviewStatsLast24h = parseInt(row.review_stats_last_24h || 0, 10);
    const cachedTerms = parseInt(row.cached_terms || 0, 10);

    const healthyReviewStats = Math.max(totalReviewStats - staleReviewStats, 0);
    const reviewCoveragePercent = totalGames === 0 ? 0 : Math.round((Math.max(totalReviewStats - gamesMissingStats, 0) / Math.max(totalGames, 1)) * 100);
    const reviewFreshnessPercent = totalReviewStats === 0 ? 0 : Math.round((healthyReviewStats / Math.max(totalReviewStats, 1)) * 100);
    const commentsFreshPercent = totalGames === 0 ? 0 : Math.round(((totalGames - staleCommentGames) / Math.max(totalGames, 1)) * 100);

    return {
        summary: {
            cacheHours,
            totalGames,
            totalReviewStats,
            gamesMissingStats,
            staleReviewStats,
            totalComments,
            staleCommentGames,
            commentsLast24h,
            reviewStatsLast24h,
            cachedTerms,
            reviewCoveragePercent,
            reviewFreshnessPercent,
            commentsFreshPercent,
            backlogEstimate: staleReviewStats + staleCommentGames + gamesMissingStats,
            lastSearchCacheEntry: row.last_search_cache_entry,
        },
        reviewQueue: staleReviewRows.rows,
        commentQueue: staleCommentRows.rows,
    };
}
async function getTopRatedGames(limit = 50, minReviews = 100, sortBy = 'rating') {
    let orderBy;
    
    switch (sortBy) {
        case 'reviews':
            orderBy = 'rs.total_reviews DESC';
            break;
        case 'recent':
            orderBy = 'g.updated_at DESC';
            break;
        case 'rating':
        default:
            orderBy = 'rs.review_score DESC, rs.total_positive DESC';
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

    const keywordList = keywords.map(kw => kw.trim().toLowerCase()).filter(kw => kw.length > 0);
    
    if (keywordList.length === 0) {
        return [];
    }

    const tsQuery = keywordList.join(' | ');

    const query = `
        WITH keyword_matches AS (
            SELECT 
                c.app_id,
                COUNT(DISTINCT c.id) as comment_matches,
                -- Contar quantas palavras-chave diferentes aparecem
                SUM(
                    CASE 
                        WHEN to_tsvector('simple', c.review) @@ to_tsquery('simple', $1) THEN 1
                        ELSE 0
                    END
                ) as keyword_score,
                -- Soma dos votos úteis dos comentários que contêm as palavras
                SUM(
                    CASE 
                        WHEN to_tsvector('simple', c.review) @@ to_tsquery('simple', $1) 
                        THEN c.votes_up 
                        ELSE 0
                    END
                ) as total_useful_votes
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
            km.keyword_score,
            km.total_useful_votes,
            -- Score de relevância (combina número de matches, score de keywords e votos úteis)
            (km.comment_matches * 10 + km.keyword_score * 5 + COALESCE(km.total_useful_votes, 0) * 0.1) as relevance_score
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

    const keywordList = keywords.map(kw => kw.trim().toLowerCase()).filter(kw => kw.length > 0);
    
    if (keywordList.length === 0) {
        return [];
    }

    const tsQuery = keywordList.join(' | ');

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

async function createUser({ email, passwordHash, displayName }) {
    const query = `
        INSERT INTO users (email, password_hash, display_name)
        VALUES (LOWER($1), $2, $3)
        RETURNING id, email, display_name, created_at
    `;
    const result = await pool.query(query, [email, passwordHash, displayName || null]);
    return result.rows[0];
}

async function findUserByEmail(email) {
    const query = `
        SELECT id, email, password_hash, display_name, created_at
        FROM users
        WHERE email = LOWER($1)
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0];
}

async function getUserById(id) {
    const query = `
        SELECT id, email, display_name, created_at
        FROM users
        WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
}

async function addFavorite(userId, appId, notes = null) {
    const query = `
        INSERT INTO user_favorites (user_id, app_id, notes)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, app_id) DO UPDATE SET notes = COALESCE($3, user_favorites.notes)
        RETURNING user_id, app_id, notes, created_at
    `;
    const result = await pool.query(query, [userId, appId, notes]);
    return result.rows[0];
}

async function listFavorites(userId) {
    const query = `
        SELECT 
            uf.app_id,
            uf.notes,
            uf.created_at,
            g.name,
            g.header_image,
            rs.review_score_desc,
            rs.total_reviews,
            rs.total_positive,
            rs.total_negative
        FROM user_favorites uf
        LEFT JOIN games g ON g.app_id = uf.app_id
        LEFT JOIN review_stats rs ON rs.app_id = uf.app_id
        WHERE uf.user_id = $1
        ORDER BY uf.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
}

async function removeFavorite(userId, appId) {
    const query = `
        DELETE FROM user_favorites
        WHERE user_id = $1 AND app_id = $2
        RETURNING app_id
    `;
    const result = await pool.query(query, [userId, appId]);
    return result.rowCount > 0;
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
    getCommentLanguageStats,
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
    getOverviewMetrics,
    getJobQueueMetrics,
    createUser,
    findUserByEmail,
    getUserById,
    addFavorite,
    listFavorites,
    removeFavorite,
};
