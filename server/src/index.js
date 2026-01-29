const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');
const { db, migrate } = require('./db');

migrate();

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const SESSION_TTL_DAYS = 30;

app.use(
  cors({
    origin: CLIENT_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json());

// --- helpers ---------------------------------------------------------------
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

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeIngredientName(name) {
  return name.trim().toLowerCase();
}

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

function authMiddleware(req, res, next) {
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

function getNextResetDate(settings, reference = new Date()) {
  const now = new Date(reference);
  const target = new Date(reference);
  target.setHours(settings.resetHour ?? 23, settings.resetMinute ?? 59, 0, 0);

  const currentDay = now.getDay(); // 0=Sun
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

function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  return db
    .prepare('SELECT id, name, email FROM users WHERE lower(email) = ?')
    .get(normalized);
}

function loadActiveTemplate() {
  const { activeTemplateId } = getSettings();
  if (!activeTemplateId) return null;
  return loadTemplateById(activeTemplateId);
}

function saveTemplate({ title, ingredients, templateId, userId }) {
  const servings = 1;
  const nowIso = new Date().toISOString();
  const insertTemplate = db.prepare(
    'INSERT INTO recipe_templates (title, servings, created_by_user_id, updated_at) VALUES (?, ?, ?, ?)',
  );
  const updateTemplate = db.prepare(
    'UPDATE recipe_templates SET title = ?, servings = ?, updated_at = ? WHERE id = ?',
  );

  const insertIngredient = db.prepare(
    'INSERT INTO template_ingredients (template_id, name, quantity, unit) VALUES (?, ?, ?, ?)',
  );
  const deleteIngredients = db.prepare(
    'DELETE FROM template_ingredients WHERE template_id = ?',
  );

  const run = db.transaction(() => {
    let id = templateId;
    if (id) {
      updateTemplate.run(title, servings, nowIso, id);
      deleteIngredients.run(id);
    } else {
      const result = insertTemplate.run(title, servings, userId ?? null, nowIso);
      id = result.lastInsertRowid;
    }
    ingredients.forEach((item) => {
      insertIngredient.run(id, item.name.trim(), item.quantity, item.unit || '');
    });
    return id;
  });

  return run();
}

function roundQuantity(value) {
  // Round to one decimal for readability
  return Math.round(value * 10) / 10;
}

function loadTemplateById(id) {
  const template = db
    .prepare(
      'SELECT id, title, servings, updated_at as updatedAt FROM recipe_templates WHERE id = ?',
    )
    .get(id);
  if (!template) return null;
  const ingredients = db
    .prepare(
      'SELECT id, name, quantity, unit FROM template_ingredients WHERE template_id = ? ORDER BY id ASC',
    )
    .all(template.id);
  return { ...template, servings: 1, ingredients };
}

// --- middleware ------------------------------------------------------------
app.use(authMiddleware);

// --- routes ----------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/register', (req, res) => {
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
  const user = { id: result.lastInsertRowid, name: name.trim(), email: normalizedEmail };
  const session = createSession(user.id);
  res
    .status(201)
    .json({ user, token: session.token, expiresAt: session.expiresAt });
});

app.post('/api/login', (req, res) => {
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

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/participants', (_req, res) => {
  const participants = db
    .prepare(
      'SELECT id, name, email, user_id as userId, created_by_user_id as createdByUserId, created_at as createdAt FROM participants ORDER BY created_at ASC',
    )
    .all();
  res.json({ participants });
});

app.post('/api/participants', requireAuth, (req, res) => {
  const { name, email } = req.body || {};
  const finalName = name?.trim() || req.user.name;
  const finalEmail = normalizeEmail(email || req.user.email);

  if (!finalName || !finalEmail) {
    return res
      .status(400)
      .json({ error: 'Name und E-Mail sind erforderlich' });
  }

  const existing = db
    .prepare('SELECT id FROM participants WHERE lower(email) = ?')
    .get(finalEmail);
  if (existing) {
    return res.status(409).json({ error: 'Bereits eingetragen' });
  }

  const matchedUser = findUserByEmail(finalEmail);
  const result = db
    .prepare(
      'INSERT INTO participants (name, email, user_id, created_by_user_id) VALUES (?, ?, ?, ?)',
    )
    .run(finalName, finalEmail, matchedUser?.id ?? null, req.user.id);

  const participant = db
    .prepare(
      'SELECT id, name, email, user_id as userId, created_by_user_id as createdByUserId, created_at as createdAt FROM participants WHERE id = ?',
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ participant });
});

app.delete('/api/participants/self', requireAuth, (req, res) => {
  const email = normalizeEmail(req.user.email);
  const participant = db
    .prepare('SELECT id FROM participants WHERE lower(email) = ?')
    .get(email);
  if (!participant) {
    return res.status(404).json({ error: 'Nicht eingetragen' });
  }
  db.prepare('DELETE FROM participants WHERE id = ?').run(participant.id);
  res.json({ removedId: participant.id });
});

app.put('/api/participants/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body || {};
  if (!name || !email) {
    return res
      .status(400)
      .json({ error: 'Name und E-Mail sind erforderlich' });
  }
  const normalizedEmail = normalizeEmail(email);
  const duplicate = db
    .prepare(
      'SELECT id FROM participants WHERE lower(email) = ? AND id != ?',
    )
    .get(normalizedEmail, id);
  if (duplicate) {
    return res.status(409).json({ error: 'E-Mail bereits eingetragen' });
  }
  const matchedUser = findUserByEmail(normalizedEmail);
  const result = db
    .prepare(
      'UPDATE participants SET name = ?, email = ?, user_id = ? WHERE id = ?',
    )
    .run(name.trim(), normalizedEmail, matchedUser?.id ?? null, id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Teilnehmer nicht gefunden' });
  }
  const participant = db
    .prepare(
      'SELECT id, name, email, user_id as userId, created_by_user_id as createdByUserId, created_at as createdAt FROM participants WHERE id = ?',
    )
    .get(id);
  res.json({ participant });
});

app.delete('/api/participants/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM participants WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Teilnehmer nicht gefunden' });
  }
  res.json({ removedId: Number(id) });
});

app.get('/api/templates', (_req, res) => {
  const templates = db
    .prepare(
      'SELECT id, title, servings, updated_at as updatedAt FROM recipe_templates ORDER BY updated_at DESC',
    )
    .all();
  res.json({ templates: templates.map((t) => ({ ...t, servings: 1 })) });
});

app.get('/api/template', (_req, res) => {
  const template = loadActiveTemplate();
  res.json({ template });
});

app.post('/api/template', requireAuth, (req, res) => {
  const { title, ingredients } = req.body || {};
  if (!title || !Array.isArray(ingredients)) {
    return res
      .status(400)
      .json({ error: 'Titel und Zutaten werden benoetigt' });
  }
  const filteredIngredients = ingredients
    .filter((item) => item.name && item.quantity !== undefined)
    .map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit || '',
    }));
  if (filteredIngredients.length === 0) {
    return res.status(400).json({ error: 'Mindestens eine Zutat angeben' });
  }
  const templateId = saveTemplate({
    title: title.trim(),
    ingredients: filteredIngredients,
    userId: req.user.id,
  });
  updateSettings({ activeTemplateId: templateId });
  const template = loadActiveTemplate();
  res.status(201).json({ template });
});

app.put('/api/template/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { title, ingredients } = req.body || {};
  if (!title || !Array.isArray(ingredients)) {
    return res
      .status(400)
      .json({ error: 'Titel und Zutaten werden benoetigt' });
  }
  const existing = db
    .prepare('SELECT id FROM recipe_templates WHERE id = ?')
    .get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Template nicht gefunden' });
  }
  const filteredIngredients = ingredients
    .filter((item) => item.name && item.quantity !== undefined)
    .map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit || '',
    }));
  saveTemplate({
    templateId: Number(id),
    title: title.trim(),
    ingredients: filteredIngredients,
    userId: req.user.id,
  });
  const template = loadTemplateById(id);
  res.json({ template });
});

app.delete('/api/template/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const result = db
    .prepare('DELETE FROM recipe_templates WHERE id = ?')
    .run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Template nicht gefunden' });
  }
  const settings = getSettings();
  res.json({
    removedId: Number(id),
    activeTemplateId: settings.activeTemplateId ?? null,
  });
});

app.post('/api/template/:id/activate', requireAuth, (req, res) => {
  const { id } = req.params;
  const template = db
    .prepare(
      'SELECT id, title, servings, updated_at as updatedAt FROM recipe_templates WHERE id = ?',
    )
    .get(id);
  if (!template) {
    return res.status(404).json({ error: 'Template nicht gefunden' });
  }
  updateSettings({ activeTemplateId: Number(id) });
  const active = loadActiveTemplate();
  res.json({ template: active });
});

app.get('/api/shopping-list', (_req, res) => {
  const template = loadActiveTemplate();
  const participants = db
    .prepare(
      'SELECT id, name, email, user_id as userId, created_at as createdAt FROM participants ORDER BY created_at ASC',
    )
    .all();
  const participantCount = participants.length;
  if (!template) {
    return res.json({
      participantCount,
      template: null,
      items: [],
    });
  }

  const exclusions = db
    .prepare(
      `
      SELECT ie.ingredient_key as ingredientKey, p.name as participantName
      FROM ingredient_exclusions ie
      JOIN participants p ON p.user_id = ie.user_id
      WHERE ie.template_id = ?
    `,
    )
    .all(template.id);
  const excludedMap = new Map();
  exclusions.forEach((row) => {
    if (!excludedMap.has(row.ingredientKey)) {
      excludedMap.set(row.ingredientKey, new Set());
    }
    excludedMap.get(row.ingredientKey).add(row.participantName);
  });

  if (participantCount === 0) {
    return res.json({
      participantCount,
      template: {
        id: template.id,
        title: template.title,
        servings: template.servings,
      },
      items: template.ingredients.map((i) => ({
        name: i.name,
        unit: i.unit,
        quantity: 0,
        excludedBy: [],
      })),
    });
  }

  const items = template.ingredients.map((ingredient) => {
    const key = normalizeIngredientName(ingredient.name);
    const excludedBy = Array.from(excludedMap.get(key) || []);
    const eligibleCount = Math.max(participantCount - excludedBy.length, 0);
    const factor = eligibleCount / template.servings;
    return {
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: roundQuantity(ingredient.quantity * factor),
      excludedBy,
    };
  });
  res.json({
    participantCount,
    template: {
      id: template.id,
      title: template.title,
      servings: template.servings,
    },
    items,
  });
});

app.get('/api/ingredient-exclusions', requireAuth, (req, res) => {
  const template = loadActiveTemplate();
  if (!template) {
    return res.json({ templateId: null, exclusions: [] });
  }
  const templateKeys = new Set(
    template.ingredients.map((item) => normalizeIngredientName(item.name)),
  );
  const rows = db
    .prepare(
      `
      SELECT ingredient_name as ingredientName
      FROM ingredient_exclusions
      WHERE user_id = ? AND template_id = ?
      ORDER BY ingredient_name ASC
    `,
    )
    .all(req.user.id, template.id);
  res.json({
    templateId: template.id,
    exclusions: rows
      .map((row) => row.ingredientName)
      .filter((name) => templateKeys.has(normalizeIngredientName(name))),
  });
});

app.put('/api/ingredient-exclusions', requireAuth, (req, res) => {
  const { exclusions } = req.body || {};
  if (!Array.isArray(exclusions)) {
    return res.status(400).json({ error: 'exclusions muss ein Array sein' });
  }
  const template = loadActiveTemplate();
  if (!template) {
    return res.status(400).json({ error: 'Kein aktives Rezept vorhanden' });
  }

  const templateMap = new Map(
    template.ingredients.map((item) => [
      normalizeIngredientName(item.name),
      item.name.trim(),
    ]),
  );

  const normalized = exclusions
    .map((name) => (typeof name === 'string' ? name.trim() : ''))
    .filter((name) => name.length > 0)
    .map((name) => normalizeIngredientName(name))
    .filter((key) => templateMap.has(key));

  const uniqueKeys = Array.from(new Set(normalized));

  const insert = db.prepare(
    `
    INSERT INTO ingredient_exclusions (user_id, template_id, ingredient_name, ingredient_key)
    VALUES (?, ?, ?, ?)
  `,
  );
  const remove = db.prepare(
    'DELETE FROM ingredient_exclusions WHERE user_id = ? AND template_id = ?',
  );

  const run = db.transaction(() => {
    remove.run(req.user.id, template.id);
    uniqueKeys.forEach((key) => {
      insert.run(req.user.id, template.id, templateMap.get(key), key);
    });
  });
  run();

  res.json({
    templateId: template.id,
    exclusions: uniqueKeys.map((key) => templateMap.get(key)),
  });
});

app.get('/api/settings/reset', (_req, res) => {
  const settings = getSettings();
  const nextReset = getNextResetDate(settings, new Date());
  res.json({
    settings,
    nextReset,
  });
});

app.put('/api/settings/reset', requireAuth, (req, res) => {
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

// --- start server ----------------------------------------------------------
scheduleWeeklyReset();

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
