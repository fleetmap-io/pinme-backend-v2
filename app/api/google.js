const { getSecretValue } = require('../secrets')
const { sign } = require('./url-signer')
const _secret = getSecretValue('GOOGLE_API_KEY')
exports.getImageUrl = async (center) => {
  const secret = await _secret
  const url = `https://maps.googleapis.com/maps/api/staticmap?maptype=hybrid&markers=${center}&center=${center}&zoom=14&size=700x500&client=gme-fleetmatics`
  return sign(url, secret.GOOGLE_API_SECRET_KEY)
}
