const express = require('express');
const { getShoppingList } = require('../services/shoppingListService');

const router = express.Router();

router.get('/shopping-list', (_req, res) => {
  const payload = getShoppingList();
  res.json(payload);
});

module.exports = router;
