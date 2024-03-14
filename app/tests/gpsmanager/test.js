const devices = require('../../devices')

describe('GPS Manager', () => {
  it('should create a user with the device', async () => {
        const result = await gpsmanager.main(require('../../../events/gpsmanager.json'))
        console.log(result)
  });
});
