const { GetItemCommand, PutItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const dynamo = new DynamoDBClient({ region: 'us-east-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const secrets = require('./secrets')
const { UsersApi } = require('traccar-api')
const TableName = process.env.USERS

exports.get = async (email) => {
  const user = await dynamo.send(new GetItemCommand({
    TableName,
    Key: marshall({ user: email })
  }))
  if (user.Item) { return unmarshall(user.Item) }
  return null
}

exports.put = (user) => {
  const put = new PutItemCommand({
    TableName,
    Item: marshall(user, { removeUndefinedValues: true })
  })
  return dynamo.send(put)
}

exports.getTraccarUser = async (userId) => {
  const auth = await secrets.getSecret('traccar')
  auth.username = auth.user
  return new UsersApi({
    basePath: 'https://api.pinme.io/api'
  }).usersGet(userId, { auth }).then(d => d.data)
}

const { safeSearch } = require('./util')
const { postUser, getUser, updateUser, deleteUser } = require('./api/traccar')
const mysql = require('./mysql')
const cognito = require('./cognito')

exports.post = async (item, adminUser) => {
  const [_user] = await this.getUser(adminUser)
  if (!item.id) {
    const { data } = await postUser(item)
    return data
  }

  const user = await getUser(item.id)
  const partnerid = _user.partnerid
  const select = `select count(*) count from traccar.tc_users 
                    where 
                    (partnerid=${partnerid} and id = ${user.id}) or
                    ${user.id} in (select manageduserid from tc_user_user uu join tc_users u on uu.userid=u.id and u.partnerid=${partnerid})
                    `
  const [rows] = await mysql.query(select, process.env.DB_HOST_READ)
  if (rows[0].count === 0) { throw new Error('access denied') }

  if (item.newAttributes) {
    console.log('updating user', item)
    for (const k of Object.keys(item.newAttributes)) {
      user.attributes[k] = item.newAttributes[k]
    }
    user.name = item.name
    user.phone = item.phone
    user.email = item.email
    console.log(user)
    console.log('traccar response', await updateUser(user))
    return {}
  }

  if (item.removeAttribute) {
    console.log('removing', item.removeAttribute, 'on', user.id)
    delete user.attributes[item.removeAttribute]
    console.log('user without attribute', user)
    await updateUser(user)
  }

  if (item.newDisabled) {
    console.log('disable user', item, item.newDisabled)
    user.disabled = item.newDisabled
    return await updateUser(user)
  }

  if (item.updatePassword) {
    console.log('update password', item)
    return cognito.changeUserPass(user.email, user.attributes.clientId, item.newPassword, user)
  }
}

exports.delete = (id) => {
  return deleteUser(id)
}

exports.getDB = async (options, user) => {
  const [_user] = await this.getUser(user)
  if (!user) throw new Error(`can't find ${user}`)
  const partnerid = _user.partnerid
  let from = `
        from tc_users users
        `

  if (options.deviceId) {
    from = ` from traccar.tc_users users 
        join traccar.tc_user_device ud on users.id = ud.userid and ud.deviceid=${options.deviceId} 
        `
  }
  from += `
    where 
    (
      users.partnerid = ${partnerid} or 
      users.id in (select manageduserid from tc_user_user uu join tc_users u on uu.userid=u.id and u.partnerid=${partnerid})
    )
  `

  if (options.search && options.search !== '') {
    options.search = safeSearch(options.search)
    from += ` and (users.name like '%${options.search}%' 
                    or users.email like '%${options.search}%' 
                    or users.phone like '%${options.search}%' 
                    or 
                    (
                      users.attributes->>'$.companyId' in 
                      (select id from bo_company where name like '%${options.search}%')
                    )
                  )
          `
  }

  from += ` and users.disabled = ${options.disabled === 'true' ? 1 : 0} `

  let orderBy = `order by 
                        ${options.sortBy !== '' && options.sortBy ? options.sortBy : 'users.id'} 
                        ${options.sortDesc === 'true' ? 'desc' : 'asc'}`
  if (options.page && options.itemsPerPage !== '-1') {
    orderBy += ` limit ${(options.page - 1) * options.itemsPerPage}, ${options.itemsPerPage}`
  }
  const queryCount = `select count(*) count ${from}`
  console.log(queryCount)
  const [count] = await mysql.query(queryCount, process.env.DB_HOST_READER)
  const select = 'select users.* '
  const querySelect = `${select} ${from} ${orderBy}`
  console.log(querySelect)
  const [result] = await mysql.query(querySelect, process.env.DB_HOST_READER)
  return { count, result }
}

exports.getUser = async (user) => {
  const [result] = await mysql.query(`select * from traccar.tc_users  where email = '${user}'`, true)
  if (!result) {
    throw new Error('User not found: ' + user)
  }
  return result
}

exports.getPartners = async (partners, user) => {
  if (!partners) return []
  const [result] = await mysql.query(`select partnerid, name, 
    (select partnerid from traccar.tc_users  where email = '${user}') currentPartnerId
 from traccar.bo_partners  where partnerid in (${partners})`)
  return result
}

exports.setPartnerId = async (user, partnerId, partners) => {
  const [result] = await mysql.query(`
    update traccar.tc_users set partnerid = ${partnerId} where
    email = '${user}' and ${partnerId} in (${partners})
    `)
  return result
}
