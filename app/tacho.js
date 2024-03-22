const cors = require('cors')
const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const CognitoExpress = require('cognito-express')
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider')
const client = new CognitoIdentityProviderClient({ region: 'eu-west-3' })
const mysql = require('./mysql')

// noinspection JSCheckFunctionSignatures
app.use(cors({ origin: true, credentials: true, methods: 'GET,PUT,POST,DELETE,OPTIONS' }))
app.use(bodyParser.json())

async function validate (cognitoExpress, accessTokenFromClient, retry = 3) {
  try {
    return await cognitoExpress.validate(accessTokenFromClient.replace('Bearer ', ''))
  } catch (e) {
    if (e.message === 'jwt expired') {
      throw e
    }
    if (--retry) {
      return await validate(cognitoExpress, accessTokenFromClient, retry)
    } else {
      console.error('giving up', e)
    }
  }
}
const cognitoUserPoolId = process.env.USER_POOL_ID
const cognitoExpress = new CognitoExpress({
  region: 'eu-west-3',
  cognitoUserPoolId,
  tokenUse: 'id',
  tokenExpiration: 3600000
})
app.use(async function (req, res, next) {
  const accessTokenFromClient = req.headers.authorization
  console.log(res.locals, req.method, req.path, req.query, req.body)
  if (!accessTokenFromClient) return res.status(401).send('Access Token missing from header')
  try {
    const user = await validate(cognitoExpress, accessTokenFromClient)
    const resp = await client.send(new AdminGetUserCommand({
      Username: user['cognito:username'],
      UserPoolId: cognitoUserPoolId
    }))
    res.locals.user = resp.UserAttributes.find(a => a.Name === 'email').Value
    next()
  } catch (e) {
    logAndSendError(e, res)
  }
})

const sqlDevices = `select id as deviceid from tc_devices where
        id in (select tud.deviceid from tc_users u
                inner join tc_user_device tud on tud.userid = u.id
                where u.email = 'userEmail') or
        groupId in (select tug.groupid from tc_users u
                inner join tc_user_group tug on tug.userid = u.id
                where u.email = 'userEmail')`

const sqlTachoDownloads = `select tr.id, tr.requestdate, tr.startdate, tr.enddate, tr.status, tr.companyid, tr.type, tr.entityid, 
        tr.conclusiondate, tr.s3id, tr.automatic
        from tacho_remotedownload tr
        inner join tc_users u on u.attributes->>'$.companyId' = tr.companyid
        left join (${sqlDevices}) td on tr.entityid = td.deviceid and tr.type = 'V'
        left join tc_user_driver tdr on u.id = tdr.userid and tr.entityid = tdr.driverid and tr.type = 'D'`

const groupBy = 'group by tr.id, tr.requestdate, tr.startdate, tr.enddate, tr.status, tr.companyid, tr.type, tr.entityid, tr.conclusiondate, tr.s3id, tr.automatic'

app.get('/', async (req, resp) => {
  try {
    const email = resp.locals.user
    console.log('TachoDownloads User:', email)
    const sql = `${sqlTachoDownloads.replaceAll('userEmail', email)} where (td.deviceid is not null or tdr.driverid is not null) and u.email = '${email}'
        and tr.status in (0,1)
        ${groupBy}
        `
    resp.json(await mysql.query(sql, true))
  } catch (e) {
    resp.json({ m: e.message })
  }
})
app.get('/tachostatus/', async (req, resp) => {
  try {
    const email = resp.locals.user
    console.log('Tacho Status User:', email)
    const sql = `select tr.lastupdate
        from tacho_remotedownload_last_update tr
        inner join tc_users u on u.attributes->>'$.companyId' = tr.companyid
        where u.email = '${email}'`
    const result = await mysql.query(sql)
    resp.json(result.length ? result[0] : null)
  } catch (e) {
    resp.json({ m: e.message })
  }
})
app.post('/tachodownloads/', async (req, resp) => {
  try {
    const email = resp.locals.user
    const body = req.body
    console.log('TachoDownloads by dates User:', email, body)
    const sql = `${sqlTachoDownloads.replaceAll('userEmail', email)} where (td.deviceid is not null or tdr.driverid is not null) and u.email = '${email}'
        and tr.requestdate > '${body.startDate}' and tr.requestdate < '${body.endDate}'
        ${groupBy}
        `
    resp.json(await mysql.query(sql, true))
  } catch (e) {
    resp.json({ m: e.message })
  }
})
app.get('/lasttachodownloads/', async (req, resp) => {
  try {
    const email = resp.locals.user
    console.log('Last TachoDownloads User:', email)
    const sql = `${sqlTachoDownloads.replaceAll('userEmail', email)} where (td.deviceid is not null or tdr.driverid is not null) and u.email = '${email}'
        and tr.id in (SELECT MAX(id) FROM tacho_remotedownload GROUP BY entityid, TYPE)
        ${groupBy}
        `
    resp.json(await mysql.query(sql, true))
  } catch (e) {
    resp.json({ m: e.message })
  }
})
app.get('/tachoconnectionstatus/', async (req, resp) => {
  try {
    const email = resp.locals.user
    console.log('Tacho connection status:', email)
    const sql = `select ti.* from tacho_installation ti 
        inner join tc_users u 
        inner join (${sqlDevices.replaceAll('userEmail', email)}) td on td.deviceid = ti.deviceid 
        where u.email = '${email}'
        `
    resp.json(await mysql.query(sql, true))
  } catch (e) {
    resp.json({ m: e.message })
  }
})
app.get('/tachodownloads/:deviceId', async (req, resp) => {
  try {
    const email = resp.locals.user
    console.log('Get Tacho Downloads by device')
    const deviceId = req.params.deviceId
    const sql = `${sqlTachoDownloads.replaceAll('userEmail', email)} where (td.deviceid is not null or tdr.driverid is not null) and u.email = '${email}'
        and entityid=${deviceId}
        ${groupBy}
        order by requestdate desc limit 10
        `
    resp.json(await mysql.query(sql, true))
  } catch (e) {
    resp.json({ m: e.message })
  }
})

const serverlessExpress = require('@vendia/serverless-express')
const { logAndSendError } = require('./utils')
exports.main = serverlessExpress({ app })
