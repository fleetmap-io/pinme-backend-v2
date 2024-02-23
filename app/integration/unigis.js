const soap = require('soap')
const urlUnigis = 'http://hub.unisolutions.com.ar/hub/unigis/MAPI/SOAP/gps/SERVICE.ASMX?wsdl'
const wsdlOptions = {
  ignoredNamespaces: {
    namespaces: ['tns'],
    override: true
  }
}

const timeout = 60000
let client

module.exports = async (devPosition) => {
  const device = devPosition.device
  const position = devPosition.position
  const args = {
    SystemUser: 'FleetTrack',
    Password: 'VLR624wax',
    Dominio: device.name,
    Codigo: 'POSICIÓN',
    NroSerie: -1,
    FechaHoraEvento: position.fixTime.substring(0, 19),
    FechaHoraRecepcion: position.serverTime.substring(0, 19),
    Latitud: position.latitude,
    Altitud: position.altitude,
    Longitud: position.longitude,
    Velocidad: Math.round(position.speed * 1.852)
  }
  if (!client) {
    client = soap.createClientAsync(urlUnigis, wsdlOptions)
  }

  console.log('unigis', args, await sendSoap(client, 'LoginYInsertarEvento', args))
}

async function sendSoap (soapClient, method, data) {
  const client = await soapClient
  return await client[method + 'Async'](data, { timeout })
}