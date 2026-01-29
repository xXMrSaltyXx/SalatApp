const { db } = require('../db');
const {
  loadActiveTemplate,
  normalizeIngredientName,
  roundQuantity,
} = require('./templateService');

function listParticipantsForShopping() {
  return db
    .prepare(
      'SELECT id, name, email, user_id as userId, created_at as createdAt FROM participants ORDER BY created_at ASC',
    )
    .all();
}

function getShoppingList() {
  const template = loadActiveTemplate();
  const participants = listParticipantsForShopping();
  const participantCount = participants.length;
  if (!template) {
    return {
      participantCount,
      template: null,
      items: [],
    };
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
    return {
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
    };
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

  return {
    participantCount,
    template: {
      id: template.id,
      title: template.title,
      servings: template.servings,
    },
    items,
  };
}

function getIngredientExclusions(userId) {
  const template = loadActiveTemplate();
  if (!template) {
    return { templateId: null, exclusions: [] };
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
    .all(userId, template.id);
  return {
    templateId: template.id,
    exclusions: rows
      .map((row) => row.ingredientName)
      .filter((name) => templateKeys.has(normalizeIngredientName(name))),
  };
}

function updateIngredientExclusions(userId, exclusions) {
  const template = loadActiveTemplate();
  if (!template) {
    return { error: 'Kein aktives Rezept vorhanden' };
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
    remove.run(userId, template.id);
    uniqueKeys.forEach((key) => {
      insert.run(userId, template.id, templateMap.get(key), key);
    });
  });
  run();

  return {
    templateId: template.id,
    exclusions: uniqueKeys.map((key) => templateMap.get(key)),
  };
}

module.exports = {
  getShoppingList,
  getIngredientExclusions,
  updateIngredientExclusions,
};
