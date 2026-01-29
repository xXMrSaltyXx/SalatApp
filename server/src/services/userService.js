const { db } = require('../db');

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  return db
    .prepare('SELECT id, name, email FROM users WHERE lower(email) = ?')
    .get(normalized);
}

module.exports = {
  normalizeEmail,
  findUserByEmail,
};
