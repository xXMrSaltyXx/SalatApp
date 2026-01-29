const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const SESSION_TTL_DAYS = 30;

module.exports = {
  PORT,
  CLIENT_ORIGIN,
  SESSION_TTL_DAYS,
};
