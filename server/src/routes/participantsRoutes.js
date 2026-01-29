const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listParticipants,
  getParticipantByEmail,
  createParticipant,
  updateParticipant,
  deleteParticipantById,
} = require('../services/participantService');
const { normalizeEmail } = require('../services/userService');

const router = express.Router();

router.get('/', (_req, res) => {
  const participants = listParticipants();
  res.json({ participants });
});

router.post('/', requireAuth, (req, res) => {
  const { name, email } = req.body || {};
  const finalName = name?.trim() || req.user.name;
  const finalEmail = normalizeEmail(email || req.user.email);

  if (!finalName || !finalEmail) {
    return res
      .status(400)
      .json({ error: 'Name und E-Mail sind erforderlich' });
  }

  const existing = getParticipantByEmail(finalEmail);
  if (existing) {
    return res.status(409).json({ error: 'Bereits eingetragen' });
  }

  const participant = createParticipant({
    name: finalName,
    email: finalEmail,
    createdByUserId: req.user.id,
  });

  res.status(201).json({ participant });
});

router.delete('/self', requireAuth, (req, res) => {
  const email = normalizeEmail(req.user.email);
  const participant = getParticipantByEmail(email);
  if (!participant) {
    return res.status(404).json({ error: 'Nicht eingetragen' });
  }
  deleteParticipantById(participant.id);
  res.json({ removedId: participant.id });
});

router.put('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body || {};
  if (!name || !email) {
    return res
      .status(400)
      .json({ error: 'Name und E-Mail sind erforderlich' });
  }
  const normalizedEmail = normalizeEmail(email);
  const duplicate = getParticipantByEmail(normalizedEmail);
  if (duplicate && String(duplicate.id) !== String(id)) {
    return res.status(409).json({ error: 'E-Mail bereits eingetragen' });
  }

  const participant = updateParticipant({
    id,
    name: name.trim(),
    email: normalizedEmail,
  });

  if (!participant) {
    return res.status(404).json({ error: 'Teilnehmer nicht gefunden' });
  }

  res.json({ participant });
});

router.delete('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const removed = deleteParticipantById(id);
  if (!removed) {
    return res.status(404).json({ error: 'Teilnehmer nicht gefunden' });
  }
  res.json({ removedId: Number(id) });
});

module.exports = router;
