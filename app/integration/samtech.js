const convert = require('xml-js')
let client
const soap = require('soap')

const wsdlOptions = {
  ignoredNamespaces: {
    namespaces: ['tns'],
    override: true
  }
}

module.exports = (devPosition) => {
  const device = devPosition.device
  const position = devPosition.position
  const data = {
    datos: {
      movil: {
        pgps: 'Verizon',
        empresa: 'Verizon',
        tercero: device.attributes.client || 'fleetrack',
        pat: device.name.replace('-', ''),
        fn: new Date(position.fixTime).toLocaleString('es-CL', { timeZone: 'America/Santiago' }).replace(/-/g, '/'),
        lat: position.latitude,
        lon: position.longitude,
        ori: position.course,
        vel: position.speed,
        mot: position.attributes.ignition ? '1' : '0',
        hdop: position.attributes.hdop || 1,
        odo: position.attributes.totalDistance / 1000,
        eve: 46,
        conductor: 'No Asignado',
        numSAT: position.attributes.sat || position.attributes.sats,
        sens1: 0,
        sens2: 0
      },
      usuario: {
        login: 'fleetrack',
        clave: 'F1eTr4c2$G.0'
      }
    }
  }
  const xml = convert.js2xml(data, { compact: true })
  console.log(device.name, data)
  if (!client) {
    client = soap.createClientAsync('http://wspos.samtech.cl/WSP.asmx?WSDL', wsdlOptions).catch(e => console.error('samtech zaldivar', e.message))
  }
  return sendSoap(client, 'Post_XML', { xmldoc: xml })
}

async function sendSoap (soapClient, method, data) {
  const client = await soapClient
  return await client[method + 'Async'](data)
}
