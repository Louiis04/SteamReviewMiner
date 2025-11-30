const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');
const popularGames = require('./popularGames');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
const hasFrontendBuild = fs.existsSync(frontendDistPath);

app.use(cors());
app.use(express.json());

if (hasFrontendBuild) {
    app.use(express.static(frontendDistPath));
}

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

app.get('/api/search', async (req, res) => {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
        return res.json({ 
            success: false, 
            message: 'Digite ao menos 2 caracteres para buscar',
            games: [] 
        });
    }

    try {
        const searchTerm = q.trim();
        console.log(`🔍 Buscando jogos com termo: "${searchTerm}"`);

        const localGames = await db.searchGamesByName(searchTerm, 10);
        
        if (localGames.length > 0) {
            console.log(`📦 [CACHE] Encontrados ${localGames.length} jogos no banco local`);
            return res.json({
                success: true,
                games: localGames.map(g => ({
                    appid: g.app_id,
                    name: g.name,
                    header_image: g.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${g.app_id}/header.jpg`
                })),
                fromCache: true
            });
        }

        const cachedSearch = await db.getSearchCache(searchTerm, 10);
        if (cachedSearch.length > 0) {
            console.log(`📦 [CACHE] Encontrados ${cachedSearch.length} jogos no cache de busca`);
            return res.json({
                success: true,
                games: cachedSearch.map(g => ({
                    appid: g.app_id,
                    name: g.name,
                    header_image: g.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${g.app_id}/header.jpg`
                })),
                fromCache: true
            });
        }

        console.log(`🌐 [API] Buscando na Steam Store Search API`);
        const searchResponse = await axios.get(
            `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(searchTerm)}`
        );

        if (searchResponse.data && searchResponse.data.length > 0) {
            const games = searchResponse.data.slice(0, 10).map(game => ({
                appid: game.appid.toString(),
                name: game.name,
                header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`
            }));

            await db.saveSearchCache(searchTerm, games);
            console.log(`💾 ${games.length} resultados salvos no cache de busca`);

            return res.json({
                success: true,
                games: games,
                fromCache: false
            });
        }

        res.json({
            success: true,
            games: [],
            message: 'Nenhum jogo encontrado'
        });

    } catch (error) {
        console.error('Erro ao buscar jogos:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar jogos',
            games: []
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

app.get('/api/preload', async (req, res) => {
    const { limit = 100 } = req.query;
    const gamesToLoad = popularGames.slice(0, parseInt(limit));
    res.json({ success: true, message: 'Pré-carregamento iniciado em background', total: gamesToLoad.length });
    setImmediate(async () => {
        console.log(`Iniciando pré-carregamento de ${gamesToLoad.length} jogos...`);
        let loaded = 0;
        let errors = 0;
        for (const appId of gamesToLoad) {
            try {
                const needsUpdate = await db.needsUpdate(appId);
                if (needsUpdate) {
                    try {
                        const detailsResponse = await axios.get(`https://store.steampowered.com/api/appdetails`, { params: { appids: appId, l: 'portuguese' } });
                        if (detailsResponse.data[appId]?.success) await db.saveGame(appId, detailsResponse.data[appId].data);
                    } catch (err) {
                        console.log(`Erro ao buscar detalhes do AppID ${appId}`);
                    }
                    try {
                        const reviewsResponse = await axios.get(`https://store.steampowered.com/appreviews/${appId}`, { params: { json: 1, num_per_page: 0, language: 'all', purchase_type: 'all' } });
                        if (reviewsResponse.data.success) {
                            await db.saveReviewStats(appId, reviewsResponse.data.query_summary);
                            loaded++;
                            console.log(`[${loaded}/${gamesToLoad.length}] AppID ${appId} carregado`);
                        }
                    } catch (err) {
                        errors++;
                        console.log(`Erro ao buscar reviews do AppID ${appId}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (error) {
                errors++;
                console.error(`Erro ao processar AppID ${appId}:`, error.message);
            }
        }
        console.log(`Pré-carregamento concluído: ${loaded} jogos carregados, ${errors} erros`);
    });
});

app.get('/api/top-games', async (req, res) => {
    try {
        const { limit = 50, min_reviews = 100, sort = 'rating' } = req.query;
        const topGames = await db.getTopRatedGames(parseInt(limit), parseInt(min_reviews), sort);
        res.json({ success: true, games: topGames, total: topGames.length });
    } catch (error) {
        console.error('Erro ao buscar top games:', error.message);
        res.status(500).json({ success: false, error: 'Erro ao buscar jogos melhores avaliados', details: error.message });
    }
});

app.get('/api/search/keywords', async (req, res) => {
    try {
        const { keywords, limit = 20, min_matches = 1 } = req.query;

        if (!keywords || keywords.trim().length === 0) {
            return res.json({ 
                success: false, 
                message: 'Por favor, forneça pelo menos uma palavra-chave',
                games: [] 
            });
        }

        const keywordArray = keywords.split(/[,;\s]+/).filter(k => k.length > 0);

        if (keywordArray.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Nenhuma palavra-chave válida fornecida',
                games: [] 
            });
        }

        console.log(`🔍 Buscando jogos com palavras-chave: [${keywordArray.join(', ')}]`);

        const games = await db.searchGamesByKeywords(
            keywordArray, 
            parseInt(limit), 
            parseInt(min_matches)
        );

        if (games.length === 0) {
            console.log(`📦 Nenhum jogo encontrado com as palavras-chave fornecidas`);
            return res.json({
                success: true,
                games: [],
                message: 'Nenhum jogo encontrado com essas palavras-chave nos comentários',
                keywords: keywordArray
            });
        }

        console.log(`📦 Encontrados ${games.length} jogos com as palavras-chave`);
        res.json({
            success: true,
            games: games,
            total: games.length,
            keywords: keywordArray
        });

    } catch (error) {
        console.error('Erro ao buscar jogos por palavras-chave:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar jogos por palavras-chave',
            details: error.message,
            games: []
        });
    }
});

app.get('/api/game/comments/keywords/:appId', async (req, res) => {
    try {
        const { appId } = req.params;
        const { keywords, limit = 10 } = req.query;

        if (!keywords || keywords.trim().length === 0) {
            return res.json({ 
                success: false, 
                message: 'Por favor, forneça pelo menos uma palavra-chave',
                comments: [] 
            });
        }

        const keywordArray = keywords.split(/[,;\s]+/).filter(k => k.length > 0);

        if (keywordArray.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Nenhuma palavra-chave válida fornecida',
                comments: [] 
            });
        }

        console.log(`🔍 Buscando comentários do jogo ${appId} com palavras-chave: [${keywordArray.join(', ')}]`);

        const comments = await db.getCommentsWithKeywords(appId, keywordArray, parseInt(limit));

        if (comments.length === 0) {
            return res.json({
                success: true,
                comments: [],
                message: 'Nenhum comentário encontrado com essas palavras-chave',
                keywords: keywordArray
            });
        }

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
            language: c.language,
            comment_relevance: c.comment_relevance
        }));

        console.log(`📦 Encontrados ${comments.length} comentários relevantes`);
        res.json({
            success: true,
            comments: formattedComments,
            total: formattedComments.length,
            keywords: keywordArray
        });

    } catch (error) {
        console.error('Erro ao buscar comentários com palavras-chave:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar comentários',
            details: error.message,
            comments: []
        });
    }
});

if (hasFrontendBuild) {
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        return res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

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
