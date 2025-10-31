const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/game/reviews/:appId', async (req, res) => {
    const { appId } = req.params;
    const { num_per_page = 0 } = req.query;

    try {
        const needsUpdate = await db.needsUpdate(appId);

        if (!needsUpdate) {
            console.log(`📦 [CACHE] Buscando dados do banco para AppID ${appId}`);
            const reviewStats = await db.getReviewStats(appId);
            
            if (reviewStats) {
                return res.json({
                    success: true,
                    query_summary: {
                        num_reviews: reviewStats.total_reviews,
                        review_score: reviewStats.review_score,
                        review_score_desc: reviewStats.review_score_desc,
                        total_positive: reviewStats.total_positive,
                        total_negative: reviewStats.total_negative,
                        total_reviews: reviewStats.total_reviews
                    },
                    fromCache: true
                });
            }
        }

        console.log(`🌐 [API] Buscando dados da Steam API para AppID ${appId}`);
        
        let game = await db.getGame(appId);
        if (!game) {
            try {
                const detailsResponse = await axios.get(
                    `https://store.steampowered.com/api/appdetails`,
                    { params: { appids: appId, l: 'portuguese' } }
                );
                
                if (detailsResponse.data[appId] && detailsResponse.data[appId].success) {
                    await db.saveGame(appId, detailsResponse.data[appId].data);
                    console.log(`💾 Detalhes do jogo salvos no banco para AppID ${appId}`);
                } else {
                    await db.saveGame(appId, { name: `Game ${appId}` });
                    console.log(`💾 Jogo ${appId} criado com dados mínimos`);
                }
            } catch (detailsError) {
                await db.saveGame(appId, { name: `Game ${appId}` });
                console.log(`💾 Jogo ${appId} criado com dados mínimos (erro ao buscar detalhes)`);
            }
        }
        
        const response = await axios.get(
            `https://store.steampowered.com/appreviews/${appId}`,
            {
                params: {
                    json: 1,
                    num_per_page: num_per_page,
                    language: 'all',
                    purchase_type: 'all'
                }
            }
        );

        if (response.data.success) {
            await db.saveReviewStats(appId, response.data.query_summary);
            console.log(`💾 Review stats salvos no banco para AppID ${appId}`);
        }

        res.json({ ...response.data, fromCache: false });
    } catch (error) {
        console.error('Erro ao buscar avaliações:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar avaliações da Steam API' 
        });
    }
});

app.get('/api/game/comments/:appId', async (req, res) => {
    const { appId } = req.params;
    const { 
        num_per_page = 10, 
        cursor = '*',
        filter = 'recent',
        page = 1
    } = req.query;

    try {
        if (cursor === '*') {
            const commentsExpired = await db.areCommentsExpired(appId);
            
            if (!commentsExpired) {
                console.log(`📦 [CACHE] Buscando comentários do banco para AppID ${appId}`);
                const limit = parseInt(num_per_page);
                const offset = (parseInt(page) - 1) * limit;
                const comments = await db.getComments(appId, limit, offset);
                const total = await db.getCommentsCount(appId);

                if (comments.length > 0) {
                    const formattedComments = comments.map(c => ({
                        recommendationid: c.recommendationid,
                        author: {
                            steamid: c.author_steamid,
                            playtime_forever: c.author_playtime_forever,
                            playtime_at_review_time: c.author_playtime_last_two_weeks
                        },
                        voted_up: c.voted_up,
                        votes_up: c.votes_up,
                        votes_down: c.votes_down,
                        votes_funny: c.votes_funny,
                        weighted_vote_score: parseFloat(c.weighted_vote_score),
                        comment_count: c.comment_count,
                        steam_purchase: c.steam_purchase,
                        received_for_free: c.received_for_free,
                        written_during_early_access: c.written_during_early_access,
                        review: c.review,
                        timestamp_created: parseInt(c.timestamp_created),
                        timestamp_updated: parseInt(c.timestamp_updated),
                        language: c.language
                    }));

                    return res.json({
                        success: true,
                        reviews: formattedComments,
                        cursor: (offset + limit < total) ? `page_${parseInt(page) + 1}` : '',
                        fromCache: true,
                        total: total
                    });
                }
            }
        }

        console.log(`🌐 [API] Buscando comentários da Steam API para AppID ${appId}`);
        
        let game = await db.getGame(appId);
        if (!game) {
            try {
                const detailsResponse = await axios.get(
                    `https://store.steampowered.com/api/appdetails`,
                    { params: { appids: appId, l: 'portuguese' } }
                );
                
                if (detailsResponse.data[appId] && detailsResponse.data[appId].success) {
                    await db.saveGame(appId, detailsResponse.data[appId].data);
                    console.log(`💾 Detalhes do jogo salvos no banco para AppID ${appId}`);
                } else {
                    await db.saveGame(appId, { name: `Game ${appId}` });
                    console.log(`💾 Jogo ${appId} criado com dados mínimos`);
                }
            } catch (detailsError) {
                await db.saveGame(appId, { name: `Game ${appId}` });
                console.log(`💾 Jogo ${appId} criado com dados mínimos (erro ao buscar detalhes)`);
            }
        }
        
        const response = await axios.get(
            `https://store.steampowered.com/appreviews/${appId}`,
            {
                params: {
                    json: 1,
                    num_per_page: num_per_page,
                    cursor: cursor === '*' ? '*' : cursor,
                    language: 'all',
                    filter: filter,
                    purchase_type: 'all'
                }
            }
        );

        if (response.data.success && response.data.reviews) {
            const savedCount = await db.saveComments(appId, response.data.reviews);
            console.log(`💾 ${savedCount} novos comentários salvos no banco para AppID ${appId}`);
        }

        res.json({ ...response.data, fromCache: false });
    } catch (error) {
        console.error('Erro ao buscar comentários:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar comentários da Steam API' 
        });
    }
});

app.get('/api/game/details/:appId', async (req, res) => {
    const { appId } = req.params;

    try {
        const game = await db.getGame(appId);
        
        if (game) {
            console.log(`📦 [CACHE] Buscando detalhes do banco para AppID ${appId}`);
            return res.json({
                [appId]: {
                    success: true,
                    data: {
                        name: game.name,
                        short_description: game.short_description,
                        header_image: game.header_image,
                        developers: game.developers ? game.developers.split(', ') : [],
                        publishers: game.publishers ? game.publishers.split(', ') : [],
                        price_overview: game.price_overview,
                        release_date: game.release_date
                    }
                },
                fromCache: true
            });
        }

        console.log(`🌐 [API] Buscando detalhes da Steam API para AppID ${appId}`);
        const response = await axios.get(
            `https://store.steampowered.com/api/appdetails`,
            {
                params: {
                    appids: appId,
                    l: 'portuguese'
                }
            }
        );

        if (response.data[appId] && response.data[appId].success) {
            await db.saveGame(appId, response.data[appId].data);
            console.log(`💾 Detalhes do jogo salvos no banco para AppID ${appId}`);
        }

        res.json({ ...response.data, fromCache: false });
    } catch (error) {
        console.error('Erro ao buscar detalhes do jogo:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar detalhes do jogo' 
        });
    }
});

app.get('/api/health', async (req, res) => {
    const dbHealth = await db.healthCheck();
    res.json({
        server: 'OK',
        database: dbHealth,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    
    const health = await db.healthCheck();
    if (health.healthy) {
        console.log(`✅ Banco de dados conectado: ${health.timestamp}`);
    } else {
        console.log(`❌ Erro ao conectar no banco: ${health.error}`);
        console.log(`⚠️  Servidor funcionará SEM cache (apenas API)`);
    }
});
