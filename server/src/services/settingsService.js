const { db } = require('../db');

const settingsStmt = db.prepare(`
  SELECT
    reset_day_of_week AS resetDayOfWeek,
    reset_hour AS resetHour,
    reset_minute AS resetMinute,
    last_reset AS lastReset,
    active_template_id AS activeTemplateId
  FROM settings
  WHERE id = 1
`);

function getSettings() {
  return settingsStmt.get();
}

function updateSettings(partial) {
  const existing = getSettings();
  const next = { ...existing, ...partial };
  db.prepare(
    `
    UPDATE settings
    SET reset_day_of_week = @resetDayOfWeek,
        reset_hour = @resetHour,
        reset_minute = @resetMinute,
        last_reset = @lastReset,
        active_template_id = @activeTemplateId
    WHERE id = 1
  `,
  ).run({
    resetDayOfWeek: next.resetDayOfWeek,
    resetHour: next.resetHour,
    resetMinute: next.resetMinute,
    lastReset: next.lastReset,
    activeTemplateId: next.activeTemplateId,
  });
  return getSettings();
}

module.exports = {
  getSettings,
  updateSettings,
};
