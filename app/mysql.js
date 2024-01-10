const mysql = require('mysql2/promise');

let conn

async function getRows(sql) {
  if (!conn) {
    conn = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE
    })
  }
  return (await conn).query(sql);
}

exports.getRows = getRows;

exports.getRowsArray = async (sql) => {
  const [result] = await getRows(sql);
  return result;
};
