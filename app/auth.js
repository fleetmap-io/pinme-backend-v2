const traccar = require('./api/traccar')
const mysql = require('./mysql')
const { getPartnerId } = require('fleetmap-partners')

async function getUser (email) {
  const [rows] = await mysql.getRows(`select 
        attributes, id, name, login, email, phone, readonly, administrator, hashedpassword, salt,
        disabled, expirationTime, deviceLimit, userLimit, deviceReadonly, token, limitCommands
        from tc_users where email='${email}'`, process.env.DB_HOST_READER)
  return rows[0]
}

exports.getUser = getUser

exports.insertUser = async (userName, name, email, clientId) => {
  console.log('insertUser', userName, name, email, clientId)
  const newUser = await traccar.createUser({
    administrator: false,
    coordinateFormat: '',
    deviceLimit: -1,
    deviceReadonly: false,
    disabled: false,
    expirationTime: null,
    id: -1,
    latitude: 0,
    limitCommands: false,
    login: '',
    longitude: 0,
    map: '',
    phone: '',
    poiLayer: '',
    readonly: false,
    token: null,
    twelveHourFormat: false,
    userLimit: -1,
    zoom: 0,
    password: process.env.TRACCAR_ADMIN_PASS,
    name: name || email,
    email,
    attributes: {
      username: userName,
      clientId,
      dashboard: false
    }
  })
  console.log(newUser.data)
  const partnerId = getPartnerId(clientId)
  console.log('partnerId', partnerId)
  console.log(await mysql.getRows(`update tc_users set partnerid=${partnerId} where id=${newUser.data.id}`))
}

async function updateUser (user, token) {
  user.password = process.env.TRACCAR_ADMIN_PASS
  if (token && user.token !== token) { user.token = token }
  return traccar.updateUser(user)
}
exports.updateUser = updateUser

exports.logout = async () => {
  await traccar.logout()
}

exports.getUserSession = async (email, token) => {
  console.log('getUserSession', email)
  let user = await getUser(email)
  if (!user) {
    throw new Error('user not found: ' + email)
  }
  const oldHash = user.hashedpassword
  const oldSalt = user.salt
  user = await traccar.getUser(user.id)
  await updateUser(user, token)
  const cookie = await traccar.createSession(email).then(d => d.headers['set-cookie'])
  await resetHash(user.id, oldHash, oldSalt)
  return cookie
}

async function resetHash (id, oldHash, oldSalt) {
  await mysql.getRows(`update tc_users set hashedpassword='${oldHash}', salt='${oldSalt}' where id=${id}`)
}

exports.resetHash = resetHash
