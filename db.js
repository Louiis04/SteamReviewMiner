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

async function getComments(appId, limit = 10, offset = 0) {
    const query = `
        SELECT * FROM comments 
        WHERE app_id = $1 
        ORDER BY timestamp_created DESC 
        LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [appId, limit, offset]);
    return result.rows;
}

async function getCommentsCount(appId) {
    const query = 'SELECT COUNT(*) as total FROM comments WHERE app_id = $1';
    const result = await pool.query(query, [appId]);
    return parseInt(result.rows[0].total);
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
                comment.language || 'unknown',
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
        return true; // Não existe, precisa buscar
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
};
