const axios = require('axios')
exports.centinela = async (e) => {
  const data = [{
    patente: e.device.name,
    imei: e.device.uniqueId,
    latitud: e.position.latitude,
    longitud: e.position.longitude,
    altitud: e.position.altitude,
    fechaHora: new Date(e.position.fixTime).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
      .replace(',', ''),
    evento: 41,
    velocidad: e.position.speed * 1.852,
    heading: e.position.course,
    ignicion: e.position.attributes.ignition ? 1 : 0
  }]
  console.log(data)
  console.log(e.device.name, await axios.post('https://external.skynav.cl/integrador/centinela/transmision', data, {
    headers: {
      Authorization: 'Bearer b17d25abe4202457daeb84c87dac0fce16d512586c35d5a0b3dc8a94d0c5ba19db5e2c84715a42a9cea67bc48187ab2a3d569fb795435f6f017bea4d9d935350'
    }
  }).then(d => d.data))
}
