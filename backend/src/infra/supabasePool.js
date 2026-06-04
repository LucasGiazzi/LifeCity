const { Pool } = require("pg");

let pool;

function createPool() {
  const newPool = new Pool({
    host: process.env.SUPABASE_DB_SERVER,
    port: 6543,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  newPool.on("error", (err) => {
    console.error("Erro no pool do Postgres:", err);
    pool = null; // força recriação no próximo getPgPool()
  });

  console.log("Pool do Postgres criado");
  return newPool;
}

async function getPgPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

// Fecha o pool com segurança (shutdown)
async function closePgPool() {
  if (pool) {
    try {
      await pool.end();
      console.log("Pool do Postgres fechado");
    } catch (err) {
      console.error("Erro ao fechar pool do Postgres:", err);
    } finally {
      pool = null;
    }
  }
}

module.exports = { getPgPool, closePgPool };