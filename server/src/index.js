const express = require('express');
const cors = require('cors');
const { migrate } = require('./db');
const { PORT, CLIENT_ORIGIN } = require('./config');
const { authMiddleware } = require('./middleware/auth');
const { scheduleWeeklyReset } = require('./services/resetService');
const authRoutes = require('./routes/authRoutes');
const participantsRoutes = require('./routes/participantsRoutes');
const templatesRoutes = require('./routes/templatesRoutes');
const shoppingRoutes = require('./routes/shoppingRoutes');
const ingredientExclusionsRoutes = require('./routes/ingredientExclusionsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const healthRoutes = require('./routes/healthRoutes');

migrate();

const app = express();

app.use(
  cors({
    origin: CLIENT_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json());

app.use(authMiddleware);

app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api/participants', participantsRoutes);
app.use('/api', templatesRoutes);
app.use('/api', shoppingRoutes);
app.use('/api', ingredientExclusionsRoutes);
app.use('/api', settingsRoutes);

scheduleWeeklyReset();

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
