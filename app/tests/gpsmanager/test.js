const gpsmanager = require('../../gpsmanager')

// eslint-disable-next-line no-undef
describe('GPS Manager', () => {
  // eslint-disable-next-line no-undef
  it('should list sms received', async () => {
    const result = await gpsmanager.main(require('./sentsms.json'))
    console.log('resul', result)
  })
})
