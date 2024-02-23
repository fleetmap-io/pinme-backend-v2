const mysql = require('../mysql')
const { getUserPartnerId } = require('../auth')
const traccar = require('../api/traccar')

const allDrivers = {}

exports.get = async (options, user) => {
  const _user = await getUserPartnerId(user)
  console.log('user', _user)
  let from = `
from traccar.tc_drivers d 
join traccar.tc_user_driver tud on d.id = tud.driverid 
join traccar.tc_users u on tud.userid = u.id 
`
  if (options.search && options.search !== '') {
    options.search = options.search.replace(/"/g, '')
    from += `  and ((u.partnerid=${_user.partnerid} or u.partnerid=0) or d.attributes->>'$.partnerId' = ${_user.partnerid}) and (           
          d.name like '%${options.search}%'
          or d.uniqueid = '${options.search}'          
          or u.email like '%${options.search}%')          
          `
  } else {
    from += ` and (u.partnerid=${_user.partnerid} or d.attributes->>'$.partnerId' = ${_user.partnerid}) `
  }

  const queryCount = `select count(distinct d.id) count ${from}`
  console.log(queryCount)
  const [count] = await mysql.query(queryCount)
  from += ` group by d.id order by ${options.sortBy || 'd.id'} ${options.sortDesc === 'true' ? 'desc' : 'asc'}`

  if (options.itemsPerPage !== '-1') {
    from += ` limit ${(options.page - 1) * options.itemsPerPage}, ${options.itemsPerPage}`
  }

  const select = 'select d.*, u.name userName, u.email userEmail, u.attributes uAttributes '
  const querySelect = `${select} ${from}`

  console.log(querySelect)
  const [result] = await mysql.query(querySelect)
  return { count: count[0], result }
}

exports.delete = async (id) => {
  return await traccar.deleteDriver(id).then(r => r.data)
}

const getDriver = async (uniqueId, retries = 3) => {
  if (!uniqueId) return null
  try {
    if (!allDrivers[uniqueId]) {
      const [driver] = await mysql.getRowsArray(`select id, name, uniqueId, attributes from traccar.tc_drivers where uniqueId='${uniqueId}'`, process.env.DB_HOST_READER)
      console.log('getDriver', uniqueId, driver)
      if (driver && driver.attributes && typeof (driver.attributes) === 'string') { driver.attributes = JSON.parse(driver.attributes) }
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
