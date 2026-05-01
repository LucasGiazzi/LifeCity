const { Pool } = require("pg");

let pool;

function createPool() {
  const newPool = new Pool({
    host: process.env.SUPABASE_DB_SERVER,
    port: 5432,
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME,
    max: 20, // máximo de conexões
    idleTimeoutMillis: 30000, // fecha conexões inativas
    connectionTimeoutMillis: 10000 // falha se não conectar em 10s
  });

  // Loga erros do pool
  newPool.on("error", (err) => {
    console.error("Erro no pool do Postgres:", err);
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