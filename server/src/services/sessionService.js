const { randomUUID } = require('crypto');
const { db } = require('../db');
const { SESSION_TTL_DAYS } = require('../config');

function createSession(userId) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  const token = randomUUID();
  db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
  ).run(token, userId, expiresAt.toISOString());
  return { token, expiresAt };
}

function getSession(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `
      SELECT s.token, s.expires_at as expiresAt, u.id as userId, u.name, u.email
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `,
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expiresAt) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return {
    token: row.token,
    user: { id: row.userId, name: row.name, email: row.email },
  };
}

module.exports = {
  createSession,
  getSession,
};
