const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/favorites', async (req, res) => {
    try {
        const favorites = await db.listFavorites(req.user.id);
        return res.json({ success: true, favorites });
    } catch (error) {
        console.error('Erro ao listar favoritos:', error.message);
        return res.status(500).json({ success: false, error: 'Erro ao listar favoritos' });
    }
});

router.post('/favorites', async (req, res) => {
    try {
        const { appId, notes } = req.body || {};
        if (!appId) {
            return res.status(400).json({ success: false, error: 'appId é obrigatório' });
        }

        const existingGame = await db.getGame(appId);
        if (!existingGame) {
            await db.saveGame(appId, { name: `Game ${appId}`, developers: [], publishers: [] });
        }

        const favorite = await db.addFavorite(req.user.id, appId, notes);
        return res.status(201).json({ success: true, favorite });
    } catch (error) {
        console.error('Erro ao salvar favorito:', error.message);
        return res.status(500).json({ success: false, error: 'Erro ao salvar favorito' });
    }
});

router.delete('/favorites/:appId', async (req, res) => {
    try {
        const { appId } = req.params;
        const removed = await db.removeFavorite(req.user.id, appId);
        if (!removed) {
            return res.status(404).json({ success: false, error: 'Favorito não encontrado' });
        }
        return res.json({ success: true, appId });
    } catch (error) {
        console.error('Erro ao remover favorito:', error.message);
        return res.status(500).json({ success: false, error: 'Erro ao remover favorito' });
    }
});

module.exports = router;
