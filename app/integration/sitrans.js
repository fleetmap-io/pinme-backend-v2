const axios = require('axios')
module.exports = async (e, Authorization = 'Basic RmxlZXRyYWNrOmIzV05KMGRnY2k5VQ==',
                         url = 'https://interop.altomovup.com/gpssignal/api/v1/data/sitrans-cl') => {
  const data = {
    num_plate: e.device.attributes.license_plate.replace(/-/g, ''),
    gps_id: e.device.uniqueId,
    lat: e.position.latitude,
    lng: e.position.longitude,
    altitude: e.position.altitude || 0,
    date_time: new Date(e.position.fixTime).toISOString().split('.')[0] + 'Z',
    ignition: e.position.attributes.ignition ? 1 : 0,
    speed: e.position.speed,
    speed_unit: 1,
    power: e.position.attributes.power || 1,
    horometer: e.position.attributes.hours || 1,
    odometer: e.position.attributes.totalDistance || 1,
    panic: 0,
    provider: 'Fleetrack',
    client: e.device.attributes.client || '.',
    provider_register: new Date().toISOString().split('.')[0] + 'Z',
    nsat: e.position.sats || 0
  }
  console.log(data)
  console.log(data.num_plate, await axios.post(url, data, {
    headers: {
      Authorization
    }
  }).then(d => d.data))
}
