const mysql = require('mysql2/promise');

let conn

async function getRows(sql, host = process.env.DB_HOST) {
  if (!conn) {
    conn = mysql.createConnection({
      host,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE
    })
  }
  return (await conn).query(sql);
}

exports.getRows = getRows;

exports.getRowsArray = async (sql, host = process.env.DB_HOST) => {
  const [result] = await getRows(sql, host);
  return result;
};
