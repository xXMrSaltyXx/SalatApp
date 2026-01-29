const { db } = require('../db');
const { normalizeEmail, findUserByEmail } = require('./userService');

function listParticipants() {
  return db
    .prepare(
      'SELECT id, name, email, user_id as userId, created_by_user_id as createdByUserId, created_at as createdAt FROM participants ORDER BY created_at ASC',
    )
    .all();
}

function getParticipantById(id) {
  return db
    .prepare(
      'SELECT id, name, email, user_id as userId, created_by_user_id as createdByUserId, created_at as createdAt FROM participants WHERE id = ?',
    )
    .get(id);
}

function getParticipantByEmail(email) {
  const normalized = normalizeEmail(email);
  return db
    .prepare('SELECT id FROM participants WHERE lower(email) = ?')
    .get(normalized);
}

function createParticipant({ name, email, createdByUserId }) {
  const normalizedEmail = normalizeEmail(email);
  const matchedUser = findUserByEmail(normalizedEmail);
  const result = db
    .prepare(
      'INSERT INTO participants (name, email, user_id, created_by_user_id) VALUES (?, ?, ?, ?)',
    )
    .run(name, normalizedEmail, matchedUser?.id ?? null, createdByUserId);
  return getParticipantById(result.lastInsertRowid);
}

function updateParticipant({ id, name, email }) {
  const normalizedEmail = normalizeEmail(email);
  const matchedUser = findUserByEmail(normalizedEmail);
  const result = db
    .prepare(
      'UPDATE participants SET name = ?, email = ?, user_id = ? WHERE id = ?',
    )
    .run(name, normalizedEmail, matchedUser?.id ?? null, id);
  if (result.changes === 0) return null;
  return getParticipantById(id);
}

function deleteParticipantById(id) {
  const result = db.prepare('DELETE FROM participants WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = {
  listParticipants,
  getParticipantById,
  getParticipantByEmail,
  createParticipant,
  updateParticipant,
  deleteParticipantById,
};
