const quicksight = require('../quicksight')
const { createActivityReport } = require('fleetmap-reports/src/partnerReports/afriquia')
const index = require('./index')

exports.getReport = async (user, parameters, traccar) => {
  console.log(parameters)
  const userData = await index.getUserData(user, traccar, parameters)
  const reportData = await createActivityReport(new Date(parameters.dateRange[0]),
    new Date(parameters.dateRange[1]), userData, traccar)

  await index.saveToS3('afriquia.csv', reportData)

  await quicksight.datasetIngestion('165e2aaa-ab05-45db-8784-3cc7f8dc8a1e')

  return quicksight.GetDashboardEmbedUrl('8c263aef-ba42-4629-b131-294ce34c3ae7')
}
