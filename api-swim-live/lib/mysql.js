const mysql = require('mysql2/promise');
require('dotenv').config();

function createPool() {
  const {
    MYSQL_HOST,
    MYSQL_PORT = 3306,
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
  } = process.env;

  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
    throw new Error('Config MySQL incompleta: define MYSQL_HOST, MYSQL_USER y MYSQL_DATABASE en el .env');
  }

  return mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
}

module.exports = createPool;
