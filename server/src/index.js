require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
});
