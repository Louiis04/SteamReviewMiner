const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const TOKEN_TTL = '7d';
const DEFAULT_SECRET = 'dev-secret';

const createToken = (user) => {
    const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
    return jwt.sign(
        {
            email: user.email,
        },
        secret,
        {
            expiresIn: TOKEN_TTL,
            subject: user.id,
        }
    );
};

router.post('/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'A senha deve ter ao menos 6 caracteres' });
        }

        const existing = await db.findUserByEmail(email);
        if (existing) {
            return res.status(409).json({ success: false, error: 'Email já cadastrado' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await db.createUser({ email, passwordHash, displayName });
        const token = createToken(user);

        return res.status(201).json({
            success: true,
            token,
            user,
        });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error.message);
        return res.status(500).json({ success: false, error: 'Erro interno ao registrar usuário' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
        }

        const user = await db.findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
        }

        const matches = await bcrypt.compare(password, user.password_hash);
        if (!matches) {
            return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
        }

        const token = createToken(user);

        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                created_at: user.created_at,
            },
        });
    } catch (error) {
        console.error('Erro ao autenticar usuário:', error.message);
        return res.status(500).json({ success: false, error: 'Erro interno ao autenticar usuário' });
    }
});

module.exports = router;
