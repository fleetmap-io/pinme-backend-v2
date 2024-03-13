const mysql = require('../mysql')
const { axios } = require('../traccar')
let companies = null
const monitrip = 'http://appservices.antt.gov.br:9000/antt/monitriip.monitoramento/rest/'
const dynamo = require('../dynamo')
const { getDriver } = require('../drivers')
const _companies = dynamo.get({ id: 'companies' }, process.env.BACKEND_TABLE).catch(e => console.error('monitrip dynamo', e.message))
let loadingCompanies = false
module.exports = async (devPosition) => {
  try {
    if (!companies) {
      companies = await _companies
      if (!companies || companies.timestamp < new Date().getTime() - 1000 * 60 * 60 * 2) {
        if (loadingCompanies) {
          console.log('ignoring getting companies from bd, already loading')
          return
        }
        loadingCompanies = true
        console.log('getting from bd, this shouldn\'t happen very often')
        companies = await mysql.getRowsArray('select * from traccar.bo_company where partnerId=10')
        const item = { id: 'companies', companies, timestamp: new Date().getTime() }
        await dynamo.put(item, process.env.BACKEND_TABLE)
        loadingCompanies = false
      } else {
        companies = companies.companies
      }
    }
    const plate = devPosition.device.attributes.license_plate && devPosition.device.attributes.license_plate.trim().replace(/-/, '').replace(' ', '')
    const company = companies.find(c => c.id === devPosition.device.attributes.clientId)
    if (!company) {
      console.warn(plate, 'cant find company for clientId', devPosition.device.attributes.clientId)
      return ''
    }
    const cnpj = (company && company.taxnumber && company.taxnumber.replace(/\./g, '').replace(/\//g, '').replace(/-/g, '').trim()) || ''
    if (devPosition.device.attributes.notes) {
      if (devPosition.position.attributes.monitrip) {
        await sendMonitripData(plate, {
          idLog: 8,
          cnpjEmpresaTransporte: cnpj,
          placaVeiculo: plate,
          autorizacaoViagem: devPosition.device.attributes.notes,
          tipoRegistroViagem: devPosition.position.attributes.monitrip === 'start' ? 1 : 0,
          sentidoLinha: 0,
          latitude: devPosition.position.latitude,
          longitude: devPosition.position.longitude,
          pdop: 0,
          dataHoraEvento: new Date(devPosition.position.fixTime).toISOString().split('.')[0],
          imei: devPosition.device.uniqueId
        }, 'InserirLogInicioFimViagemFretado')
      }
      const driver = await getDriver(devPosition.position.attributes.driverUniqueId)
      if (driver && driver.attributes.notes) {
        await sendMonitripData(plate, {
          idLog: 5,
          cnpjEmpresaTransporte: cnpj,
          placaVeiculo: plate,
          cpfMotorista: driver.attributes.notes.trim()
            .replace(/\./g, '')
            .replace(/\//g, '')
            .replace(/-/g, ''),
          tipoRegistroEvento: devPosition.position.attributes.ignition ? '1' : '0',
          latitude: devPosition.position.latitude,
          longitude: devPosition.position.longitude,
          pdop: 0,
          dataHoraEvento: new Date(devPosition.position.fixTime).toISOString().split('.')[0],
          imei: devPosition.device.uniqueId
        }, 'InserirLogJornadaTrabalhoMotorista')
      }
      if (devPosition.position.attributes.ignition) {
        await sendMonitripData(plate, {
          cnpjEmpresaTransporte: cnpj,
          idLog: 4,
          placaVeiculo: plate,
          velocidadeAtual: Math.round(devPosition.position.speed),
          distanciaPercorrida: 0,
          situacaoIgnicaoMotor: devPosition.position.attributes.ignition ? '1' : '0',
          situacaoPortaVeiculo: 0,
          latitude: devPosition.position.latitude,
          longitude: devPosition.position.longitude,
          pdop: 0,
          dataHoraEvento: new Date(devPosition.position.fixTime).toISOString().split('.')[0],
          imei: devPosition.device.uniqueId
        }, 'InserirLogVelocidadeTempoLocalizacao')
      }
    }
    return ''
  } catch (e) {
    loadingCompanies = false
    if (e.message && e.message.startsWith('Throughput exceeds the current capacity of your table or index')) {
      console.warn('sendMonitrip', e.message, devPosition.device.name)
    } else {
      console.error('sendMonitrip', e.message, devPosition.device.name)
    }
  }
}

async function sendMonitripData (plate, data, method) {
  console.log(`${plate} ${method}`, await axios.post(monitrip + method, data, {
    headers: {
      Authorization: '61229a50-56b8-4a6f-85cd-2fba64af3532'
    }
  }).then(d => d.data).catch(e => {
    console.warn(plate, data)
    console.warn(plate, method, e.message, e.status, e.statusMessage, e.response && e.response.data)
  }
  ))
}
