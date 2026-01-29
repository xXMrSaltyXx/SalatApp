const { db } = require('../db');
const { getSettings } = require('./settingsService');

function normalizeIngredientName(name) {
  return name.trim().toLowerCase();
}

function roundQuantity(value) {
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

module.exports = {
  normalizeIngredientName,
  roundQuantity,
  loadTemplateById,
  loadActiveTemplate,
  saveTemplate,
};
