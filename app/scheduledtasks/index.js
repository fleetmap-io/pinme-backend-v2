const mysql = require('../mysql')
const traccar = require('../api/traccar')
const { findCountryByCoordinate } = require('country-locator')
const partnerByCountry = {
  Chile: 1,
  Qatar: 6,
  Senegal: 12,
  Brazil: 10,
  Portugal: 9,
  Morocco: 5,
  Spain: 14
}
const disabledByCountry = {}

exports.checkCountries = async () => {
  const rows = await mysql.getRowsArray(`
        select d.id, p.address, d.uniqueId, d.phone, d.attributes, d.partnerid, p.protocol, 
        p.attributes pAttributes, p.latitude, p.longitude, d.name, d.positionId
        from tc_devices d 
        left join tc_positions_last p on p.deviceid = d.id
        where partnerid = -1 and d.disabled = 0
        `, process.env.DB_HOST_READER)
  const countries = {}
  for (const r of rows) {
    const countryInfo = r.latitude && findCountryByCoordinate([r.longitude, r.latitude])
    const countryFromGeocoding = r.address && r.address.split(',').slice(-1)[0].trim()
    const country = countryInfo?.name || countryFromGeocoding
    countries[country] = (countries[country] || 0) + 1
    if (partnerByCountry[country]) {
      console.log('updating', r.id, r.name, 'from', country, 'to partner', partnerByCountry[country])
      await mysql.getRows(`update tc_devices set partnerid=${partnerByCountry[country]} where id=${r.id}`)
    } else if (disabledByCountry[country]) {
      const [device] = await traccar.getDevices(r.uniqueId).then(d => d.data)
      if (!device) { continue }
      device.disabled = true
      console.log('disable device from', country, r)
      await traccar.updateDevice(device.id, device)
    } else if (!r.address) {
      console.log('deleting', r)
      await traccar.deleteDevice(r.id)
    } else {
      console.log('ignoring', country, r)
    }
  }
}
