const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const db = require("./db");
const popularGames = require("./popularGames");

// Configurações do BM25
const k1 = 1.5;
const b = 0.75;

// Função auxiliar para calcular Score de Utilidade
function calculateUtilityScore(review) {
  // Cálculo do Score Bruto (Raw Score)
  const wVotes = 0.5; // Cada voto útil vale 0.5 no bruto
  const wFunny = 0.1; // Voto "engraçado" vale menos
  const wLength = 0.002; // 500 caracteres = 1 ponto bruto

  // Fator de tempo de jogo (Logarítmico base 10)
  // Ex: 10h -> ~1.1x | 100h -> ~1.2x | 1000h -> ~1.3x
  const hours = (review.author_playtime_forever || 0) / 60;
  const playTimeFactor = 1 + Math.log10(1 + hours) * 0.1;

  const votesScore =
    (review.votes_up || 0) * wVotes + (review.votes_funny || 0) * wFunny;
  const lengthScore = (review.review ? review.review.length : 0) * wLength;

  // Base de 2 pontos para qualquer review que exista (evitar que tenha um score 0/10 imediato)
  const baseScore = 2.0;

  let rawScore = (baseScore + votesScore + lengthScore) * playTimeFactor;

  const k = 0.15;
  let finalScore = 10 * (1 - Math.exp(-k * rawScore));

  return parseFloat(finalScore.toFixed(2));
}

function calculateBM25(reviews, queryTerm) {
  const term = queryTerm.toLowerCase();
  const N = reviews.length; 
  let docCountWithTerm = 0;
  let totalWords = 0;

  // Pré-processamento: calcular tamanho de cada doc e frequência do termo
  const processedDocs = reviews.map((review) => {
    const words = (review.review || "").toLowerCase().match(/\b(\w+)\b/g) || [];
    const docLen = words.length;
    totalWords += docLen;

    const freq = words.filter((w) => w === term).length;
    if (freq > 0) docCountWithTerm++;

    return {
      original: review,
      docLen,
      freq,
    };
  });

  const avgdl = totalWords / N || 1; // Tamanho médio do documento (evita div por 0)

  // Calcular IDF (Inverse Document Frequency)
  // Fórmula IDF padrão do BM25: log( (N - n + 0.5) / (n + 0.5) + 1 )
  const idf = Math.log(
    (N - docCountWithTerm + 0.5) / (docCountWithTerm + 0.5) + 1
  );

  // Calcular Score para cada documento
  const scoredDocs = processedDocs.map((doc) => {
    const { freq, docLen } = doc;

    // O numerador da parte TF do BM25
    const numerator = freq * (k1 + 1);

    // O denominador da parte TF do BM25
    const denominator = freq + k1 * (1 - b + b * (docLen / avgdl));

    const score = idf * (numerator / denominator);

    return {
      review: doc.original.review,
      score: score,
      utilityScore: calculateUtilityScore(doc.original), // Score de Utilidade
      recommendationid: doc.original.recommendationid,
      // Repassar dados originais para o frontend usar
      votes_up: doc.original.votes_up,
      votes_down: doc.original.votes_down,
      voted_up: doc.original.voted_up,
      author: {
        steamid: doc.original.author_steamid,
        playtime_forever: doc.original.author_playtime_forever,
      },
      timestamp_created: doc.original.timestamp_created,
    };
  });

  // Filtrar apenas scores positivos e ordenar
  return scoredDocs
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/api/game/reviews/:appId", async (req, res) => {
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
            total_reviews: reviewStats.total_reviews,
          },
          fromCache: true,
        });
      }
    }

    console.log(`🌐 [API] Buscando dados da Steam API para AppID ${appId}`);

    let game = await db.getGame(appId);
    if (!game) {
      try {
        const detailsResponse = await axios.get(
          `https://store.steampowered.com/api/appdetails`,
          { params: { appids: appId, l: "portuguese" } }
        );

        if (
          detailsResponse.data[appId] &&
          detailsResponse.data[appId].success
        ) {
          await db.saveGame(appId, detailsResponse.data[appId].data);
          console.log(
            `💾 Detalhes do jogo salvos no banco para AppID ${appId}`
          );
        } else {
          await db.saveGame(appId, { name: `Game ${appId}` });
          console.log(`💾 Jogo ${appId} criado com dados mínimos`);
        }
      } catch (detailsError) {
        await db.saveGame(appId, { name: `Game ${appId}` });
        console.log(
          `💾 Jogo ${appId} criado com dados mínimos (erro ao buscar detalhes)`
        );
      }
    }

    const response = await axios.get(
      `https://store.steampowered.com/appreviews/${appId}`,
      {
        params: {
          json: 1,
          num_per_page: num_per_page,
          language: "all",
          purchase_type: "all",
        },
      }
    );

    if (response.data.success) {
      await db.saveReviewStats(appId, response.data.query_summary);
      console.log(`💾 Review stats salvos no banco para AppID ${appId}`);
    }

    res.json({ ...response.data, fromCache: false });
  } catch (error) {
    console.error("Erro ao buscar avaliações:", error.message);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar avaliações da Steam API",
    });
  }
});

app.get("/api/game/comments/:appId", async (req, res) => {
  const { appId } = req.params;
  const {
    num_per_page = 50,
    cursor = "*",
    filter = "recent",
    page = 1,
    sentiment,
    minPlaytime,
    minVotesUp,
    minTextLength,
    dateOrder,
  } = req.query;

  const filters = {
    sentiment,
    minPlaytime: minPlaytime ? parseInt(minPlaytime) : undefined,
    minVotesUp: minVotesUp ? parseInt(minVotesUp) : undefined,
    minTextLength: minTextLength ? parseInt(minTextLength) : undefined,
    dateOrder,
  };

  try {
    const hasCustomFilters =
      sentiment || minPlaytime || minVotesUp || minTextLength || dateOrder;
    const commentsExpired = await db.areCommentsExpired(appId);

    if (commentsExpired && cursor === "*") {
      console.log(
        `🌐 [API] Cache expirado ou vazio. Buscando novos comentários da Steam API para AppID ${appId}`
      );
    }

    if (cursor === "*" || hasCustomFilters) {
      if (!commentsExpired || hasCustomFilters) {
        console.log(
          `📦 [CACHE] Buscando comentários do banco para AppID ${appId} com filtros:`,
          filters
        );
        const limit = parseInt(num_per_page);
        const offset = (parseInt(page) - 1) * limit;
        const comments = await db.getComments(appId, limit, offset, filters);
        const total = await db.getCommentsCount(appId, filters);

        if (total > 0 || hasCustomFilters) {
          const formattedComments = comments.map((c) => ({
            recommendationid: c.recommendationid,
            author: {
              steamid: c.author_steamid,
              playtime_forever: c.author_playtime_forever,
              playtime_at_review_time: c.author_playtime_last_two_weeks,
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
            utilityScore: calculateUtilityScore(c),
          }));

          return res.json({
            success: true,
            reviews: formattedComments,
            cursor: offset + limit < total ? `page_${parseInt(page) + 1}` : "",
            fromCache: true,
            total: total,
          });
        }
      }
    }

    console.log(
      `🌐 [API] Buscando comentários da Steam API para AppID ${appId}`
    );

    let game = await db.getGame(appId);
    if (!game) {
      try {
        const detailsResponse = await axios.get(
          `https://store.steampowered.com/api/appdetails`,
          { params: { appids: appId, l: "portuguese" } }
        );

        if (
          detailsResponse.data[appId] &&
          detailsResponse.data[appId].success
        ) {
          await db.saveGame(appId, detailsResponse.data[appId].data);
          console.log(
            `💾 Detalhes do jogo salvos no banco para AppID ${appId}`
          );
        } else {
          await db.saveGame(appId, { name: `Game ${appId}` });
          console.log(`💾 Jogo ${appId} criado com dados mínimos`);
        }
      } catch (detailsError) {
        await db.saveGame(appId, { name: `Game ${appId}` });
        console.log(
          `💾 Jogo ${appId} criado com dados mínimos (erro ao buscar detalhes)`
        );
      }
    }

    const response = await axios.get(
      `https://store.steampowered.com/appreviews/${appId}`,
      {
        params: {
          json: 1,
          num_per_page: num_per_page,
          cursor: cursor === "*" ? "*" : cursor,
          language: "all",
          filter: filter,
          purchase_type: "all",
        },
      }
    );

    if (response.data.success && response.data.reviews) {
      const savedCount = await db.saveComments(appId, response.data.reviews);
      console.log(
        `💾 ${savedCount} novos comentários salvos no banco para AppID ${appId}`
      );
    }

    // Adiciona o utilityScore nas reviews vindas da API da Steam
    const reviewsWithScore = response.data.reviews
      ? response.data.reviews.map((r) => ({
          ...r,
          utilityScore: calculateUtilityScore(r),
        }))
      : [];

    res.json({ ...response.data, reviews: reviewsWithScore, fromCache: false });
  } catch (error) {
    console.error("Erro ao buscar comentários:", error.message);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar comentários da Steam API",
    });
  }
});

app.get("/api/game/details/:appId", async (req, res) => {
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
            developers: game.developers ? game.developers.split(", ") : [],
            publishers: game.publishers ? game.publishers.split(", ") : [],
            price_overview: game.price_overview,
            release_date: game.release_date,
          },
        },
        fromCache: true,
      });
    }

    console.log(`🌐 [API] Buscando detalhes da Steam API para AppID ${appId}`);
    const response = await axios.get(
      `https://store.steampowered.com/api/appdetails`,
      {
        params: {
          appids: appId,
          l: "portuguese",
        },
      }
    );

    if (response.data[appId] && response.data[appId].success) {
      await db.saveGame(appId, response.data[appId].data);
      console.log(`💾 Detalhes do jogo salvos no banco para AppID ${appId}`);
    }

    res.json({ ...response.data, fromCache: false });
  } catch (error) {
    console.error("Erro ao buscar detalhes do jogo:", error.message);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar detalhes do jogo",
    });
  }
});

app.get("/api/reviews/search", async (req, res) => {
  const { appId, query } = req.query;

  if (!appId || !query) {
    return res.status(400).json({ error: "AppID e Query são obrigatórios" });
  }

  try {
    console.log(`🔍 [BM25] Buscando "${query}" em reviews do AppID ${appId}`);

    // 1. Tenta pegar do banco (cache) - Limitando a 5000 para performance em memória
    // Se não houver reviews no banco, o ideal seria buscar da API, mas para este milestone
    // vamos assumir que o usuário já carregou as reviews na página principal.
    let reviews = await db.getComments(appId, 5000, 0);

    // 2. Se não tiver, retorna erro ou array vazio
    if (!reviews || reviews.length === 0) {
      return res.status(404).json({
        error:
          "Nenhuma review encontrada para este jogo. Analise-o primeiro na home.",
      });
    }

    // 3. Computar BM25 em memória
    const results = calculateBM25(reviews, query);

    console.log(
      `✅ [BM25] Encontrados ${results.length} resultados relevantes`
    );

    // Retorna top 20 resultados
    res.json(results.slice(0, 20));
  } catch (error) {
    console.error("Erro na busca BM25:", error);
    res.status(500).json({ error: "Erro ao processar busca" });
  }
});

app.get("/api/search", async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json({
      success: false,
      message: "Digite ao menos 2 caracteres para buscar",
      games: [],
    });
  }

  try {
    const searchTerm = q.trim();
    console.log(`🔍 Buscando jogos com termo: "${searchTerm}"`);

    const localGames = await db.searchGamesByName(searchTerm, 10);

    if (localGames.length > 0) {
      console.log(
        `📦 [CACHE] Encontrados ${localGames.length} jogos no banco local`
      );
      return res.json({
        success: true,
        games: localGames.map((g) => ({
          appid: g.app_id,
          name: g.name,
          header_image:
            g.header_image ||
            `https://cdn.akamai.steamstatic.com/steam/apps/${g.app_id}/header.jpg`,
        })),
        fromCache: true,
      });
    }

    const cachedSearch = await db.getSearchCache(searchTerm, 10);
    if (cachedSearch.length > 0) {
      console.log(
        `📦 [CACHE] Encontrados ${cachedSearch.length} jogos no cache de busca`
      );
      return res.json({
        success: true,
        games: cachedSearch.map((g) => ({
          appid: g.app_id,
          name: g.name,
          header_image:
            g.header_image ||
            `https://cdn.akamai.steamstatic.com/steam/apps/${g.app_id}/header.jpg`,
        })),
        fromCache: true,
      });
    }

    console.log(`🌐 [API] Buscando na Steam Store Search API`);
    const searchResponse = await axios.get(
      `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(
        searchTerm
      )}`
    );

    if (searchResponse.data && searchResponse.data.length > 0) {
      const games = searchResponse.data.slice(0, 10).map((game) => ({
        appid: game.appid.toString(),
        name: game.name,
        header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
      }));

      await db.saveSearchCache(searchTerm, games);
      console.log(`💾 ${games.length} resultados salvos no cache de busca`);

      return res.json({
        success: true,
        games: games,
        fromCache: false,
      });
    }

    res.json({
      success: true,
      games: [],
      message: "Nenhum jogo encontrado",
    });
  } catch (error) {
    console.error("Erro ao buscar jogos:", error.message);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar jogos",
      games: [],
    });
  }
});

app.get("/api/health", async (req, res) => {
  const dbHealth = await db.healthCheck();
  res.json({
    server: "OK",
    database: dbHealth,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/preload", async (req, res) => {
  const { limit = 100 } = req.query;
  const gamesToLoad = popularGames.slice(0, parseInt(limit));
  res.json({
    success: true,
    message: "Pré-carregamento iniciado em background",
    total: gamesToLoad.length,
  });
  setImmediate(async () => {
    console.log(`Iniciando pré-carregamento de ${gamesToLoad.length} jogos...`);
    let loaded = 0;
    let errors = 0;
    for (const appId of gamesToLoad) {
      try {
        const needsUpdate = await db.needsUpdate(appId);
        if (needsUpdate) {
          try {
            const detailsResponse = await axios.get(
              `https://store.steampowered.com/api/appdetails`,
              { params: { appids: appId, l: "portuguese" } }
            );
            if (detailsResponse.data[appId]?.success)
              await db.saveGame(appId, detailsResponse.data[appId].data);
          } catch (err) {
            console.log(`Erro ao buscar detalhes do AppID ${appId}`);
          }
          try {
            const reviewsResponse = await axios.get(
              `https://store.steampowered.com/appreviews/${appId}`,
              {
                params: {
                  json: 1,
                  num_per_page: 0,
                  language: "all",
                  purchase_type: "all",
                },
              }
            );
            if (reviewsResponse.data.success) {
              await db.saveReviewStats(
                appId,
                reviewsResponse.data.query_summary
              );
              loaded++;
              console.log(
                `[${loaded}/${gamesToLoad.length}] AppID ${appId} carregado`
              );
            }
          } catch (err) {
            errors++;
            console.log(`Erro ao buscar reviews do AppID ${appId}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (error) {
        errors++;
        console.error(`Erro ao processar AppID ${appId}:`, error.message);
      }
    }
    console.log(
      `Pré-carregamento concluído: ${loaded} jogos carregados, ${errors} erros`
    );
  });
});

app.get("/api/top-games", async (req, res) => {
  try {
    const { limit = 50, min_reviews = 100, sort = "rating" } = req.query;
    const topGames = await db.getTopRatedGames(
      parseInt(limit),
      parseInt(min_reviews),
      sort
    );
    res.json({ success: true, games: topGames, total: topGames.length });
  } catch (error) {
    console.error("Erro ao buscar top games:", error.message);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar jogos melhores avaliados",
      details: error.message,
    });
  }
});

app.get("/api/search/keywords", async (req, res) => {
  try {
    const { keywords, limit = 20, min_matches = 1 } = req.query;

    if (!keywords || keywords.trim().length === 0) {
      return res.json({
        success: false,
        message: "Por favor, forneça pelo menos uma palavra-chave",
        games: [],
      });
    }

    const keywordArray = keywords.split(/[,;\s]+/).filter((k) => k.length > 0);

    if (keywordArray.length === 0) {
      return res.json({
        success: false,
        message: "Nenhuma palavra-chave válida fornecida",
        games: [],
      });
    }

    console.log(
      `🔍 Buscando jogos com palavras-chave: [${keywordArray.join(", ")}]`
    );

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
        message:
          "Nenhum jogo encontrado com essas palavras-chave nos comentários",
        keywords: keywordArray,
      });
    }

    console.log(`📦 Encontrados ${games.length} jogos com as palavras-chave`);
    res.json({
      success: true,
      games: games,
      total: games.length,
      keywords: keywordArray,
    });
  } catch (error) {
    console.error("Erro ao buscar jogos por palavras-chave:", error.message);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar jogos por palavras-chave",
      details: error.message,
      games: [],
    });
  }
});

app.get("/api/game/comments/keywords/:appId", async (req, res) => {
  try {
    const { appId } = req.params;
    const { keywords, limit = 10 } = req.query;

    if (!keywords || keywords.trim().length === 0) {
      return res.json({
        success: false,
        message: "Por favor, forneça pelo menos uma palavra-chave",
        comments: [],
      });
    }

    const keywordArray = keywords.split(/[,;\s]+/).filter((k) => k.length > 0);

    if (keywordArray.length === 0) {
      return res.json({
        success: false,
        message: "Nenhuma palavra-chave válida fornecida",
        comments: [],
      });
    }

    console.log(
      `🔍 Buscando comentários do jogo ${appId} com palavras-chave: [${keywordArray.join(
        ", "
      )}]`
    );

    const comments = await db.getCommentsWithKeywords(
      appId,
      keywordArray,
      parseInt(limit)
    );

    if (comments.length === 0) {
      return res.json({
        success: true,
        comments: [],
        message: "Nenhum comentário encontrado com essas palavras-chave",
        keywords: keywordArray,
      });
    }

    const formattedComments = comments.map((c) => ({
      recommendationid: c.recommendationid,
      author: {
        steamid: c.author_steamid,
        playtime_forever: c.author_playtime_forever,
        playtime_at_review_time: c.author_playtime_last_two_weeks,
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
      comment_relevance: c.comment_relevance,
      utilityScore: calculateUtilityScore(c),
    }));

    console.log(`📦 Encontrados ${comments.length} comentários relevantes`);
    res.json({
      success: true,
      comments: formattedComments,
      total: formattedComments.length,
      keywords: keywordArray,
    });
  } catch (error) {
    console.error(
      "Erro ao buscar comentários com palavras-chave:",
      error.message
    );
    res.status(500).json({
      success: false,
      error: "Erro ao buscar comentários",
      details: error.message,
      comments: [],
    });
  }
});

app.get("/api/export/bm25", async (req, res) => {
  const { appId, query } = req.query;

  if (!appId || !query) {
    return res
      .status(400)
      .json({ error: "AppID e Query são obrigatórios para exportação." });
  }

  try {
    // ALTERAÇÃO AQUI:
    // Definimos um limite altíssimo (1 milhão) para garantir que traga TUDO o que existe no banco local.
    // O '0' é o offset (começa do primeiro).
    const reviews = await db.getComments(appId, 10000, 0);

    if (!reviews || reviews.length === 0) {
      return res
        .status(404)
        .json({ message: "Sem reviews salvas no banco para este jogo." });
    }

    // 2. Calcula BM25 em memória com todos os dados retornados
    const results = calculateBM25(reviews, query);

    // 3. Monta o objeto de exportação
    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        app_id: appId,
        query_term: query,
        total_reviews_in_db: reviews.length, // Total analisado
        total_matches: results.length, // Total que deu match com a busca
        algorithm: "BM25 + Utility Score Hybrid",
      },
      results: results.map((r) => ({
        id: r.recommendationid,
        steam_id: r.author_steamid,
        score_bm25: r.score,
        score_utility: r.utilityScore,
        votes_up: r.votes_up,
        // Correção para evitar "NaN" se o tempo for nulo
        playtime_hours: ((r.author_playtime_forever || 0) / 60).toFixed(1),
        text_snippet: r.review ? r.review.substring(0, 100) : "",
      })),
    };

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=export_bm25_${appId}_${query}.json`
    );
    res.setHeader("Content-Type", "application/json");

    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error("Erro na exportação:", error);
    res.status(500).json({ error: "Erro ao exportar dados." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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
