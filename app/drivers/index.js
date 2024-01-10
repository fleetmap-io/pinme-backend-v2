const mysql = require('../mysql-reader')

const allDrivers = {}

const getDriver = async (uniqueId, retries = 3) => {
  if (!uniqueId) return null
  try {
    if (!allDrivers[uniqueId]) {
      const [driver] = await mysql.getRowsArray(`select id, name, uniqueId, attributes from traccar.tc_drivers where uniqueId='${uniqueId}'`)
      console.log('getDriver', uniqueId, driver)
      if (driver && driver.attributes && typeof(driver.attributes) == 'string') { driver.attributes = JSON.parse(driver.attributes) }
      allDrivers[uniqueId] = driver
    }
  } catch (e) {
    if (--retries) {
      return getDriver(uniqueId, retries)
    } else {
      console.error('getDriver error after 3 retries', uniqueId, e.message)
    }
  }
  return allDrivers[uniqueId]
}

exports.getDriver = getDriver
