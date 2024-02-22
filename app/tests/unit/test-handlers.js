'use strict'

const app = require('../../app.js')
require('../../event')
const pinmeapi = require('../../pinmeapi')
const gpsmanager = require('../../gpsmanager')
const chai = require('chai')
const expect = chai.expect
const email = require('../../email/email')
const fs = require('fs')
const path = require('path')
const cw = require('../../cloudwatch')
const traccar = require('../../auth')
const { pushPositions } = require('../../push')
const { eventsAndPositionsConsumer } = require('../../index')
const users = require('../../users')

function checkResult (result) {
  console.log(result)
  expect(result).to.be.an('object')
  expect(result.statusCode).to.equal(200)
  expect(result.body).to.be.an('string')
}

// eslint-disable-next-line no-undef
describe('Tests index', function () {
  // eslint-disable-next-line no-undef
  it('works on main-function', async () => {
    const result = await app.mainFunction(require('../../../events/event.json'))
    checkResult(result)
    const response = JSON.parse(result.body)
    expect(response).to.be.equal('')
  })

  // eslint-disable-next-line no-undef
  it('works on push-events-function with ignitionoff', async () => {
    await eventsAndPositionsConsumer(require('../../../events/pushEvent.json'))
  })

  // eslint-disable-next-line no-undef
  it('works on pinemapi', async () => {
    let result = await pinmeapi.main(require('../../../events/pinmeapi.json'))
    checkResult(result)
    result = await pinmeapi.main(require('../../../events/pinmeapi.json'))
    console.log(result)
  })

  // eslint-disable-next-line no-undef
  it('works on gpsmanager', async () => {
    const result = await gpsmanager.main(require('../../../events/gpsmanager.json'))
    checkResult(result)
    console.log(result)
  })

  // eslint-disable-next-line no-undef
  it('sends emails', async () => {
    await email.email(['joaquim.cardeira@gmail.com'], ['wuizygo@gmail.com'], 'notification', 'teste notification', 'no-reply@gpsmanager.io')
    await email.emailWithAttachment(
      ['joaquim.cardeira@gmail.com'],
      ['admin@fleetmap.io'],
      'report',
      'teste report',
      'no-reply@gpsmanager.io',
      { // stream as an attachment
        filename: 'text4.txt',
        content: fs.createReadStream(path.join(__dirname, 'file.txt'))
      })
  })

  // eslint-disable-next-line no-undef
  it('sends cloudwatch metrics', async () => {
    await cw.putMetrics({ resources: ['rule/everyMinute'] })
    await cw.putMetrics({ resources: ['rule/every5'] })
  })

  // eslint-disable-next-line no-undef
  it('works with traccar', async () => {
    const cookie = await traccar.getUserSession('joaquim@fleetmap.io')
    expect(cookie).to.be.an('Array')
    expect(cookie[0]).to.not.equal('')
  })

  // eslint-disable-next-line no-undef
  it('pushes positions', async () => {
    await pushPositions(require('../../../events/position'))
  })

  // eslint-disable-next-line no-undef
  it('changes password', async () => {
    const user = { id: 8253, email: 'joaquim@fleetmap.io' }
    await users.post({ ...user, updatePassword: true, newPassword: process.env.NEW_PASSWORD }, 'joaquim@fleetmap.io')
  }, 10000)
})
