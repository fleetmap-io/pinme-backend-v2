const axios = require('axios')
let token = null
module.exports = async (devPosition) => {
  if (!token) {
    const data = {
      SEG: {
        F: {
          id: 'USER_API_GPS_SLS@MAERSK.COM',
          password: '/pTS04lSyxjdAlCMAhh7AA==',
          sistem_id: 2
        }
      },
      AUT: {
        F: {
          clientId: 'API_MAERSK_EXT',
          clientSecret: '33caa750333af31d49d39e9251ecb121'
        }
      }
    }
    const { result } = await axios.post('https://slsperu.inlandservices.com/api/inlandnet/Inlandnet/security/UserServiceImp/apiUserLogin', data).then(d => d.data)
    token = result.token
  }
  const _axios = axios.create({ headers: { Authorization: 'Bearer ' + token, jpoNoMappingBody: true } })
  const data = [{
    provider_id: 'FLEETRACK',
    vehicle: devPosition.device.name,
    latitude: devPosition.position.latitude,
    longitude: devPosition.position.longitude,
    speed: devPosition.position.speed,
    address: devPosition.position.address
  }]
  console.log(data, await _axios.post('https://sls.inlandservices.com/api/moduletms/ModuleTMS/module/tms/TMSGpsreception/gpsreception', data).then(d => d.data))
}
