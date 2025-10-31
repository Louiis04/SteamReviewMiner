const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/game/reviews/:appId', async (req, res) => {
    const { appId } = req.params;
    const { num_per_page = 0 } = req.query;

    try {
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

        res.json(response.data);
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
        filter = 'recent'
    } = req.query;

    try {
        const response = await axios.get(
            `https://store.steampowered.com/appreviews/${appId}`,
            {
                params: {
                    json: 1,
                    num_per_page: num_per_page,
                    cursor: cursor,
                    language: 'all',
                    filter: filter,
                    purchase_type: 'all'
                }
            }
        );

        res.json(response.data);
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
        const response = await axios.get(
            `https://store.steampowered.com/api/appdetails`,
            {
                params: {
                    appids: appId,
                    l: 'portuguese'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Erro ao buscar detalhes do jogo:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar detalhes do jogo' 
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
