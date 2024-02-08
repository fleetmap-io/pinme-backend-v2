const idProvider = '77056973-7'
const idCompany = '96799790-0'
const axios = require('axios').create({ baseURL: 'https://caserones.owlchile.cl/v1/' + idProvider })
module.exports = async (e) => {
  const token = await axios.get('login', { headers: { auth: 'Fleetrack2024' } }).then(d => d.data)
  const licensePlate = e.device.attributes.license_plate.replace('-', '').trim()
  const url = `${idCompany}/${licensePlate}/event`
  const data = {
    code: 0,
    datetime: new Date().getTime(),
    id_provider: idProvider,
    latitude: e.position.latitude,
    longitude: e.position.longitude,
    id_company: idCompany,
    license_plate: licensePlate,
    head: e.position.course,
    velocity: parseInt(e.position.speed),
    engine: e.position.attributes.ignition ? 1 : 0,
    altitude: e.position.altitude,
    satellites: 0,
    bpanic: -1,
    signal: 0,
    hdop: 0,
    odometer: 0,
    deferred: 0,
    roadscope: -1,
    id_driver: ''
  }
  console.log('owl', data, url)
  console.log('owl', await axios.post(url, data, { headers: { authentication: 'Bearer ' + token.access_token } }).then(d => d.data))
}
