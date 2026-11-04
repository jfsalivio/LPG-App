const pool = require('../config/db');
const schema = require('./customerAuthSchema');
async function migrate() {
  try {
    await pool.query(schema);
    console.log('CustomerAuth account table is ready. Existing customer and staff records were preserved.');
  } finally { await pool.end(); }
}
migrate().catch(error => {
  console.error('Customer authentication migration failed:', error.code || error.message);
  process.exitCode = 1;
});
