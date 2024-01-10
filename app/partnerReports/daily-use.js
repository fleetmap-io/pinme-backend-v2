const index = require('./index')
const { createDailyUseReport } = require('fleetmap-reports/src/partnerReports/dailyuse-report')
const { showReport } = require('./performance')

const quicksightParameters = {
  csvName: 'daily-use.csv',
  datasetId: 'a627677c-39d6-4edd-b0e4-ff581b63ff8e',
  dashboardId: 'aa4e428f-abf7-4219-ad1b-6074aace25b2'
}

exports.getReport = async (user, parameters, traccar) => {
  console.log(parameters)
  const userData = await index.getUserData(user, traccar, parameters)
  const reportData = await createDailyUseReport(
    new Date(parameters.dateRange[0]),
    new Date(parameters.dateRange[1]),
    userData,
    traccar)

  return await showReport(quicksightParameters, reportData)
}
