const mysql = require('mysql2/promise')

const conn = {}

const user = process.env.DB_USER
const password = process.env.DB_PASSWORD
const database = process.env.DB_DATABASE

async function initConn (host, retries = 10) {
   try {
    return await mysql.createConnection({host, user, password, database})
  } catch(e) {
      console.error('connection error', host, e.message, 'try again', retries)
      if (retries--) {
        return initConn(host, retries)
      } else {
        throw e
      }
    }
  }

async function getRows (sql, host = process.env.DB_HOST) {
  if (!conn[host]) {
    conn[host] = initConn(host)
  }
  console.log('connection', (await conn[host]))
  if ((await conn[host]).state === 'disconnected') {
    conn[host] = initConn(host)
  }
  return (await conn[host]).query(sql)
}

exports.getRows = getRows

exports.getRowsArray = async (sql, host = process.env.DB_HOST) => {
  const [result] = await getRows(sql, host)
  return result
}
