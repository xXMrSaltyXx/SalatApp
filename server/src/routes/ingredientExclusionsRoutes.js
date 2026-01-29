const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getIngredientExclusions,
  updateIngredientExclusions,
} = require('../services/shoppingListService');

const router = express.Router();

router.get('/ingredient-exclusions', requireAuth, (req, res) => {
  const payload = getIngredientExclusions(req.user.id);
  res.json(payload);
});

router.put('/ingredient-exclusions', requireAuth, (req, res) => {
  const { exclusions } = req.body || {};
  if (!Array.isArray(exclusions)) {
    return res.status(400).json({ error: 'exclusions muss ein Array sein' });
  }
  const result = updateIngredientExclusions(req.user.id, exclusions);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

module.exports = router;
