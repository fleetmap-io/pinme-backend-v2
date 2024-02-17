require('../../event')
const pinmeapi = require('../../pinmeapi')
const chai = require('chai')
const expect = chai.expect

function checkResult (result) {
  console.log(result)
  expect(result).to.be.an('object')
  expect(result.statusCode).to.equal(200)
  expect(result.body).to.be.an('string')
}

// eslint-disable-next-line no-undef
describe('Tests index', function () {
  // eslint-disable-next-line no-undef
  it('works on pinemapi', async () => {
    process.env.S3_BUCKET = 'alb-reports'
    const result = await pinmeapi.main(require('./passenger.json'))
    checkResult(result)
    console.log(result)
  })
})
