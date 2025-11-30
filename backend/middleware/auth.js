const jwt = require('jsonwebtoken');

const DEFAULT_SECRET = 'dev-secret';

function authMiddleware(req, res, next) {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token ausente' });
    }

    const token = authorization.replace('Bearer ', '').trim();

    try {
        const secret = process.env.JWT_SECRET || DEFAULT_SECRET;
        const payload = jwt.verify(token, secret);
        req.user = { id: payload.sub, email: payload.email };
        return next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
    }
}

module.exports = authMiddleware;
