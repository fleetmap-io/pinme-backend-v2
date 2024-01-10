const mysql = require('mysql2/promise');

const pool = mysql.createConnection({
  host: process.env.DB_HOST_READER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

async function getRows(sql) {
  return (await pool).query(sql);
}

exports.getRows = getRows;

exports.getRowsArray = async (sql) => {
  const [result] = await getRows(sql);
  return result;
};
