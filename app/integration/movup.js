const axios = require('axios')
module.exports = async (e) => {
  try { await require('./sitrans')(e, 'Basic RmxlZXRyYWNrOnlZb0htR2tFN21Yag==', 'https://interop.altomovup.com/gpssignal/api/v1/data/ulog-cl') } catch (ex) {
    console.warn('sitrans', (ex.response && ex.response.data) || ex.message, e)
  }
  const data = {
    lng: e.position.longitude,
    lat: e.position.latitude,
    altitude: e.position.altitude,
    ignition: e.position.attributes.ignition,
    speed: e.position.speed,
    num_plate: e.device.attributes.license_plate && e.device.attributes.license_plate.replace(/[ \t-]/g, ''),
    provider: 'Fleetrack',
    gps_id: e.device.id,
    date_time: e.position.fixTime
  }
  console.log('movup', data,
    await axios.post('https://segmentado.ziyu.cl/api/restapp/gpssignal/external/', data,
      {
        timeout: 3000,
        headers: {
          Username: 'Fleetrack',
          Password: 'yYoHmGkE7mXj'
        }
      }).then(d => d.data).catch(ex => { console.warn((ex.response && ex.response.data) || ex, 'movup', data, e.position && e.position.address) }))
}
