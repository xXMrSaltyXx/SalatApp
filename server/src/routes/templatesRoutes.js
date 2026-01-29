const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { db } = require('../db');
const {
  loadActiveTemplate,
  loadTemplateById,
  saveTemplate,
} = require('../services/templateService');
const { updateSettings, getSettings } = require('../services/settingsService');

const router = express.Router();

router.get('/templates', (_req, res) => {
  const templates = db
    .prepare(
      'SELECT id, title, servings, updated_at as updatedAt FROM recipe_templates ORDER BY updated_at DESC',
    )
    .all();
  res.json({ templates: templates.map((t) => ({ ...t, servings: 1 })) });
});

router.get('/template', (_req, res) => {
  const template = loadActiveTemplate();
  res.json({ template });
});

router.post('/template', requireAuth, (req, res) => {
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

router.put('/template/:id', requireAuth, (req, res) => {
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

router.delete('/template/:id', requireAuth, (req, res) => {
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

router.post('/template/:id/activate', requireAuth, (req, res) => {
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

module.exports = router;
