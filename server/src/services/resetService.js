const { db } = require('../db');
const { getSettings } = require('./settingsService');

function getNextResetDate(settings, reference = new Date()) {
  const now = new Date(reference);
  const target = new Date(reference);
  target.setHours(settings.resetHour ?? 23, settings.resetMinute ?? 59, 0, 0);

  const currentDay = now.getDay();
  const targetDay = settings.resetDayOfWeek ?? 5;
  let daysAhead = (targetDay - currentDay + 7) % 7;
  if (daysAhead === 0 && target <= now) {
    daysAhead = 7;
  }
  target.setDate(now.getDate() + daysAhead);
  return target;
}

function getMostRecentResetDate(settings, reference = new Date()) {
  const next = getNextResetDate(settings, reference);
  const recent = new Date(next);
  recent.setDate(recent.getDate() - 7);
  return recent;
}

function performWeeklyReset() {
  db.prepare('DELETE FROM participants').run();
  const nowIso = new Date().toISOString();
  db.prepare('UPDATE settings SET last_reset = ? WHERE id = 1').run(nowIso);
  console.log(`[reset] Teilnehmerliste geleert um ${nowIso}`);
}

let resetTimer = null;
function scheduleWeeklyReset() {
  const settings = getSettings();
  const now = new Date();
  const lastReset = settings.lastReset ? new Date(settings.lastReset) : null;
  const mostRecentScheduled = getMostRecentResetDate(settings, now);
  if (!lastReset || lastReset < mostRecentScheduled) {
    performWeeklyReset();
  }

  const nextReset = getNextResetDate(settings, new Date());
  const delay = nextReset.getTime() - Date.now();
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    performWeeklyReset();
    scheduleWeeklyReset();
  }, delay);
  console.log(
    `[reset] Nächste automatische Leere am ${nextReset.toLocaleString()}`,
  );
}

module.exports = {
  getNextResetDate,
  scheduleWeeklyReset,
};
