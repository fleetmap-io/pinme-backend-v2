const soap = require('soap')
const { normalize } = require('./utils')
const urlUnigis = 'http://hub.unisolutions.com.ar/hub/unigis/MAPI/SOAP/gps/SERVICE.ASMX?wsdl'
const wsdlOptions = {
  ignoredNamespaces: {
    namespaces: ['tns'],
    override: true
  }
}

const timeout = 4000
let client

module.exports = async (devPosition) => {
  const device = devPosition.device
  const position = devPosition.position
  const args = {
    SystemUser: 'FleetTrack',
    Password: 'VLR624wax',
    Dominio: normalize(device.attributes.license_plate),
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

  console.log('unigis', args, 'result:', await sendSoap(client, 'LoginYInsertarEvento', args))
}

async function sendSoap (soapClient, method, data) {
  const client = await soapClient
  return await client[method + 'Async'](data, { timeout })
}
