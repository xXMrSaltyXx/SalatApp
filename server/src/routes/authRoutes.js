const express = require('express');
const { createSession } = require('../services/sessionService');
const { normalizeEmail, findUserByEmail } = require('../services/userService');
const { requireAuth } = require('../middleware/auth');
const { db } = require('../db');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) {
    return res
      .status(400)
      .json({ error: 'Name und E-Mail sind erforderlich' });
  }
  const normalizedEmail = normalizeEmail(email);
  const existing = findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'E-Mail ist bereits registriert' });
  }
  const result = db
    .prepare('INSERT INTO users (name, email) VALUES (?, ?)')
    .run(name.trim(), normalizedEmail);
  const user = {
    id: result.lastInsertRowid,
    name: name.trim(),
    email: normalizedEmail,
  };
  const session = createSession(user.id);
  res
    .status(201)
    .json({ user, token: session.token, expiresAt: session.expiresAt });
});

router.post('/login', (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'E-Mail ist erforderlich' });
  }
  const user = findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  }
  const session = createSession(user.id);
  res.json({ user, token: session.token, expiresAt: session.expiresAt });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
