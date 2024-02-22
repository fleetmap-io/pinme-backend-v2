const { GetItemCommand, PutItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const traccar = require('./api/traccar')

exports.getIgnitionOff = async (deviceId) => {
  const device = await dynamo.send(new GetItemCommand({
    TableName: process.env.DEVICE_IGNITION_OFF_TABLE,
    Key: marshall({ deviceId })
  }))
  if (device.Item) { return unmarshall(device.Item) }
  return null
}

exports.put = (device) => {
  const put = new PutItemCommand({
    TableName: process.env.DEVICE_IGNITION_OFF_TABLE,
    Item: marshall(device, { removeUndefinedValues: true })
  })
  return dynamo.send(put)
}

const mysql = require('./mysql')
const { safeSearch } = require('./util')

exports.delete = async (id) => {
  const response = await traccar.devices.delete(id)
  console.log(response)
  return response
}

exports.getConfById = async (deviceId, user) => {
  console.log('getConfById', deviceId)
  const select = `select dd.*, d.name from 
              traccar.bo_device_details dd  join traccar.tc_devices d on d.id = dd.deviceid and d.id=${deviceId}
                                    join traccar.tc_users u on u.email = '${user}' and d.partnerid=u.partnerid`
  console.log(select)
  const [result] = await mysql.query(select, true)
  console.log(result)
  return result
}

exports.getByUniqueId = async (uniqueId, user) => {
  console.log('getByUniqueId', uniqueId, user)
  const [response] = await traccar.getDevices(uniqueId)
  console.log(response)
  return response
}
exports.getById = (id) => traccar.devices.get(id)

exports.postById = async (deviceId, user, body) => {
  console.log('post by id', deviceId, user, body)
  const { device, columns } = body
  let query = `
    insert ignore into traccar.bo_device_details (deviceid)
    values (${deviceId})`
  if (device) {
    query += `on duplicate key update ${columns.map(key => key + '=\'' + device[key] + '\'').join(',')} `
  }
  console.log(query)
  return await mysql.query(query)
}

exports.get = async (options, user, partners) => {
  let from = `
        from traccar.tc_devices d
        left join traccar.tc_groups g on d.groupid = g.id
        left join traccar.bo_device_details dd on d.id=dd.deviceid 
        left join traccar.bo_device_type dt on d.attributes->>'$.deviceType' = dt.id 
        left join traccar.tc_positions_last p on p.deviceid = d.id
        left join traccar.bo_company c on c.id = d.attributes->>'$.clientId'
        `
  if (!partners || !partners.length || !partners.includes('-1')) {
    from += ` join traccar.tc_users u on u.email = '${user}' and d.partnerid = u.partnerid `
  }

  from += ' where 1=1 '

  if (options.search && options.search !== '') {
    options.search = safeSearch(options.search)
    from += ` and (
          d.name like '%${options.search}%'
          or c.name like '%${options.search}%'
          or dt.name like '%${options.search}%'
          or dd.lastaction like '%${options.search}%'
          or g.name like '%${options.search}%'
          or dd.lastsmsstatus = '${options.search}'
          or d.uniqueid like '%${options.search}%'
          or d.phone like '%${options.search}%'
          or d.licenseplate = '${options.search}'
          or p.protocol like '%${options.search}%'
          or d.attributes like '%${options.search}%' COLLATE utf8mb4_general_ci
          ${isNaN(options.search) || options.search.trim() === '' ? '' : 'or d.id = ' + options.search}
          )
          `
  }
  if (options.noPosition === 'true') {
    from += ' and p.fixTime is null '
  }
  if (options.noConfig === 'true') {
    from += ' and (dd.lastactiondate is null or lastaction is null) '
  }
  if (options.externalSource === 'true') {
    from += ' and p.attributes->>\'$.source\' = \'import\' '
  }
  if (options.noSms === 'true') {
    from += ' and dd.lastsms is null '
  }
  if (options.showFilterDate === 'true') {
    from += ` and p.fixTime between FROM_UNIXTIME(${options.filterDate}) and FROM_UNIXTIME(${options.filterDate2}) `
  }
  from += ` and d.disabled = ${options.disabled === 'true' ? 1 : 0} `

  let orderColumn
  switch (options.sortBy) {
    case 'subtel':
      orderColumn = 'd.attributes->\'$.subtel\''
      break
    case 'license_plate':
      orderColumn = 'LOWER(d.attributes->\'$.license_plate\')'
      break
    case 'apn':
      orderColumn = 'd.attributes->\'$.apn\''
      break
    case 'device':
      orderColumn = 'json_extract(d.attributes, "$.deviceType")'
      break
    case 'client':
      orderColumn = 'c.name'
      break
    case '':
    case null:
    case undefined:
      orderColumn = 'd.id'
      break
    default:
      orderColumn = options.sortBy
  }
  let orderBy = `order by ${orderColumn}
                            ${options.sortDesc === 'true' ? 'desc' : 'asc'}`

  if (options.itemsPerPage !== '-1') {
    orderBy += ` limit ${(options.page - 1) * options.itemsPerPage}, ${options.itemsPerPage}`
  }
  const queryCount = `select count(*) count ${from}`
  console.log(queryCount)
  const [count] = await mysql.query(queryCount, true)
  const select = `select d.id, d.name, p.fixTime lastupdate, p.attributes->>'$.source' source, p.address, 
        p.attributes->>'$.rpm' rpm, p.attributes->>'$.fuelUsed' fuelUsed, p.attributes->>'$.versionFw' versionFw,
        d.phone, dd.lastaction, c.name client, d.licenseplate, p.latitude, p.longitude,
        g.name groupName, dt.name device, d.uniqueid, d.model, dd.lastsms, dd.lastsmsstatus, dd.immobilizationType,
        d.attributes->>'$.apn' apn, d.attributes, p.firstlocationdate, dd.lastactiondate, d.attributes->>'$.deviceType' devicetype, p.speed, p.protocol
        `
  const querySelect = `${select} ${from} ${orderBy}`
  console.log(querySelect)
  const [result] = await mysql.query(querySelect, true)
  return { count, result }
}

exports.post = async (item, user) => {
  console.log(item)
  if (item.attributes && item.attributes.apn) {
    item.apn = item.attributes.apn
  }

  if (item.addUserId) {
    console.log('addPermission device', item.id, 'user', item.addUserId.id)
    const permission = { userId: item.addUserId.id, deviceId: item.id }
    await traccar.permissions.add(permission)
  }

  if (item.newAttributes) {
    const device = await traccar.devices.get(item.id)
    console.log(device)
    for (const k of Object.keys(item.newAttributes)) {
      device.attributes[k] = item.newAttributes[k]
    }
    device.name = item.name
    device.phone = item.phone
    device.uniqueId = item.uniqueid || item.uniqueId
    try {
      console.log('updating device', device)
      await traccar.devices.update(device)
    } catch (e) {
      console.error(device.name, e.message, e.response && e.response.data)
    }
  }

  if (item.removeAttribute) {
    const device = await traccar.devices.get(item.id)
    console.log('removing', item.removeAttribute, 'on', device.id)
    delete device.attributes[item.removeAttribute]
    console.log('device without attribute', device)
    await traccar.devices.update(device)
  }

  if (item.removeComputedAttribute) {
    console.log('removePermission device ', item.id, 'attribute', item.removeComputedAttribute.id)
    const permission = { deviceId: item.id, attributeId: item.removeComputedAttribute.id }
    await traccar.permissions.delete(permission)
  }

  if (item.newDisabled) {
    console.log(user, 'enable or disable', item)
    const device = await traccar.devices.get(item.id)
    device.disabled = item.newDisabled
    await traccar.devices.update(device)
  }

  if (item.removeGroup) {
    console.log(user, 'remove group', item)
    const device = await traccar.devices.get(item.id)
    device.groupId = null
    await traccar.devices.update(device)
  }

  if (item.updatePartnerId) {
    const query2 = `
      update traccar.tc_devices set partnerid = (select partnerid from traccar.tc_users where email = '${user}') where id = ${item.id}
    `
    console.log(query2)
    console.log(await mysql.query(query2))
  }

  if (item.switchImeiAndSim) {
    try {
      const device0 = await traccar.devices.get(item.id)
      const device1 = await traccar.devices.getUniqueId(item.switchImeiAndSim)

      console.log('switch imei and sim', device0, device1)
      const newImei1 = device0.uniqueId
      const newImei0 = device1.uniqueId
      const newPhone1 = device0.phone
      const newPhone0 = device1.phone
      const newAPN1 = device0.attributes.apn
      const newAPN0 = device1.attributes.apn
      const newSerial1 = device0.attributes.serialNumber
      const newSerial0 = device1.attributes.serialNumber
      const newDeviceType1 = device0.attributes.deviceType
      const newDeviceType0 = device1.attributes.deviceType
      device0.attributes.old_imei = device0.uniqueId
      device1.attributes.old_imei = device1.uniqueId
      device0.uniqueId = generateRandomString()
      device1.uniqueId = generateRandomString()
      console.log(await traccar.devices.update(device0))
      console.log(await traccar.devices.update(device1))
      device0.uniqueId = newImei0
      device1.uniqueId = newImei1
      device0.phone = newPhone0
      device1.phone = newPhone1
      device0.attributes.apn = newAPN0
      device1.attributes.apn = newAPN1
      device0.attributes.serialNumber = newSerial0
      device1.attributes.serialNumber = newSerial1
      device0.attributes.deviceType = newDeviceType0
      device1.attributes.deviceType = newDeviceType1
      console.log(await traccar.devices.update(device0))
      console.log(await traccar.devices.update(device1))
    } catch (e) {
      console.error(e)
      throw e
    }
  }

  return { body: 'ok' }
}

const generateRandomString = () => {
  let result = ''
  const chars =
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (let i = 32; i > 0; i -= 1) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

exports.getComputedAttributes = async (deviceid) => {
  return await traccar.attributes.get(deviceid)
}

exports.getCanProtocols = async () => {
  console.log('getCanProtocols')
  const select = 'select dd.id, GROUP_CONCAT(dd.designation) designation from traccar.bo_canprotocol dd where dd.device_family = \'inofleet\' group by id'
  const [result] = await mysql.query(select, true)
  console.log('returning', result)
  return result
}

exports.putDevice = async (item, user) => {
  return await traccar.putDevice(item, user)
}
