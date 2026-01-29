const { getSession } = require('../services/sessionService');

function authMiddleware(req, _res, next) {
  const token = req.header('x-session-token');
  const session = getSession(token);
  if (session) {
    req.sessionToken = session.token;
    req.user = session.user;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }
  next();
}

module.exports = {
  authMiddleware,
  requireAuth,
};
