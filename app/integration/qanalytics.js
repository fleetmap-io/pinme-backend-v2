const urlQ = 'http://ww2.qanalytics.cl/gps_fleetrack/service.asmx?WSDL'
const soap = require('soap')
let qClient = null

const wsdlOptions = {
  ignoredNamespaces: {
    namespaces: ['tns'],
    override: true
  }
}

module.exports = async (devPosition) => {
  devPosition.device.name = devPosition.device.name.replace('-', '').replace(' ', '')
  if (qClient === null) {
    qClient = await soap.createClientAsync(urlQ, wsdlOptions)
    qClient.addSoapHeader({
      'tns:Authentication': {
        'tns:Usuario': 'WS_fleetrack',
        'tns:Clave': '$$WS20'
      }
    })
  }
  await _sendQ(devPosition)
}

async function _sendQ (devPosition) {
  const device = devPosition.device
  const position = devPosition.position

  const args = {
    'tns:ID_REG': device.uniqueId,
    'tns:FH_DATO': new Date(position.fixTime).toISOString(),
    'tns:PLACA': device.attributes.license_plate && device.attributes.license_plate.trim().replace('-', ''),
    'tns:TEMP1': position.attributes.temp1 !== 175
      ? position.attributes.temp1
      : position.attributes.temp2 !== 175 ? position.attributes.temp2 : undefined,
    'tns:TEMP2': position.attributes.temp2 !== 175 ? position.attributes.temp2 : undefined,
    'tns:LATITUD': position.latitude,
    'tns:LONGITUD': position.longitude,
    'tns:TRANS': device.groupName ? device.groupName : '',
    'tns:VELOCIDAD': Math.round(position.speed * 1.852),
    'tns:SENTIDO': Math.round(position.course),
    'tns:IGNITION': position.ignition ? 1 : 0
  }

  console.log('qanalytics', args, await qClient.WM_INS_REPORTE_PUNTO_A_PUNTOAsync(args))
}
