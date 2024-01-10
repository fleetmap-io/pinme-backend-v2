const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const client = new SecretsManagerClient({ region: 'us-east-1' })
const _mapillary = client.send(new GetSecretValueCommand({ SecretId: 'mapillary' })).then(s => JSON.parse(s.SecretString))
const axios = require('axios')
const circle = require('@turf/circle')
const bbox = require('@turf/bbox')
const crg = require('country-reverse-geocoding').country_reverse_geocoding()

exports.get = async (params) => {
  const country = crg.get_country(parseFloat(params.latitude), parseFloat(params.longitude))
  switch (country && country.code) {
    case 'QAT':
      console.log('ignoring', country)
      return
  }
  const _mapillary = await mapillary(params)
  if (_mapillary) { return _mapillary.thumb_256_url }
}

exports.imageUrl = async (params) => {
  const _mapillary = await mapillary(params)
  if (_mapillary) { return 'https://www.mapillary.com/app/?trafficSign=all&pKey=' + _mapillary.id }
  return `https://www.google.com/maps/@?api=1&map_action=pano&heading=${params.course}&viewpoint=${params.latitude},${params.longitude}`
}

async function mapillary (params) {
  let url
  try {
    const secret = await _mapillary
    const baseUrl = `https://graph.mapillary.com/images?access_token=${secret.token}&fields=id,compass_angle,thumb_256_url`
    const bb = bbox.default(circle.default(
      [params.longitude, params.latitude],
      14,
      { steps: 4, units: 'meters' }
    ))
    url = baseUrl + `&bbox=${bb.join(',')}`
    const { data } = await axios.get(url).then(d => d.data)
    if (data.length) {
      data.sort((a, b) => {
        return Math.abs(params.course - a.compass_angle) - Math.abs(params.course - b.compass_angle)
      })
      return data[0]
    }
    console.log('no mapillary at ', params)
  } catch (e) {
    console.warn('mapillary', e.message, params, url)
  }
  return null
}
