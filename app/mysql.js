const mysql = require('mysql2/promise')
const user = process.env.DB_USER
const password = process.env.DB_PASSWORD
const database = process.env.DB_DATABASE

async function getRows (sql, host = process.env.DB_HOST) {
  const conn = await mysql.createConnection({ host, user, password, database })
  const result = conn.query(sql)
  await conn.end()
  return result
}
exports.getRows = getRows

exports.getRowsArray = async (sql, host = process.env.DB_HOST) => {
  const [result] = await getRows(sql, host)
  return result
}

exports.query = getRows
