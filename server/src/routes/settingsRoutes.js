const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../services/settingsService');
const { getNextResetDate, scheduleWeeklyReset } = require('../services/resetService');

const router = express.Router();

router.get('/settings/reset', (_req, res) => {
  const settings = getSettings();
  const nextReset = getNextResetDate(settings, new Date());
  res.json({
    settings,
    nextReset,
  });
});

router.put('/settings/reset', requireAuth, (req, res) => {
  const { resetDayOfWeek, resetHour, resetMinute } = req.body || {};
  if (
    resetDayOfWeek === undefined ||
    resetHour === undefined ||
    resetMinute === undefined
  ) {
    return res
      .status(400)
      .json({ error: 'resetDayOfWeek, resetHour und resetMinute sind nötig' });
  }
  const updated = updateSettings({
    resetDayOfWeek: Number(resetDayOfWeek),
    resetHour: Number(resetHour),
    resetMinute: Number(resetMinute),
  });
  scheduleWeeklyReset();
  res.json({ settings: updated });
});

module.exports = router;
