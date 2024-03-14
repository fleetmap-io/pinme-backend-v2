const soap = require('soap')
const url = 'https://ws.softlogbrasil.com.br/softlog?wsdl'
const _client = soap.createClientAsync(url)
module.exports = async (devPos) => {
  const client = await _client
  try {
    const position = {
      plate: devPos.device.name.replace(' ', '').replace('-', ''),
      date: new Date(devPos.position.fixTime).toISOString(),
      latitude: devPos.position.latitude,
      longitude: devPos.position.longitude,
      speed: devPos.position.speed,
      ignition: devPos.position.attributes.ignition
    }
    console.log('softlog', position)
    return await client.sendPositionsAsync({
      user: 'nogartel', passwd: 'n0g@rt3l', positions: [position]
    }, { timeout: 4000 })
  } catch (e) {
    console.log(client.lastRequest)
    console.warn('softlog', e.message, e.response && e.response.data)
  }
}
