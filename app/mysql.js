const mysql = require('mysql2/promise')
const user = process.env.DB_USER
const password = process.env.DB_PASSWORD
const database = process.env.DB_DATABASE

async function getRows (sql, reader = false) {
  const conn = await mysql.createConnection({
    host: reader
      ? process.env.DB_HOST_READER
      : process.env.DB_HOST,
    user,
    password,
    database,
    typeCast: function castField (field, useDefaultTypeCasting) {
      // We only want to cast bit fields that have a single-bit in them. If the field
      // has more than one bit, then we cannot assume it is supposed to be a Boolean.
      if ((field.type === 'BIT') && (field.length === 1)) {
        const bytes = field.buffer()
        // A Buffer in Node represents a collection of 8-bit unsigned integers.
        // Therefore, our single "bit field" comes back as the bits '0000 0001',
        // which is equivalent to the number 1.
        return (bytes[0] === 1)
      }
      return (useDefaultTypeCasting())
    }
  })
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
