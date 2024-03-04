const dynamo = require('./dynamo')
const automaticReports = require('./reports/automaticReports')

exports.sendReport = async (req) => {
  // const user = await new SessionApi(apiConfig).sessionGet(null, {headers: {cookie: req.header('cookie')}}).then(d => d.data)
  const id = req.params.id
  const item = await dynamo.get({ id }, 'scheduler-1')
  console.log('data', item)
  automaticReports.sendMessage(item.userId, [item])
}
