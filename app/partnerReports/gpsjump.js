const index = require('./index')
const { createGPSJumpReport } = require('fleetmap-reports/src/partnerReports/gpsjump-report')
const { showReport } = require('./performance')

const quicksightParameters = {
  csvName: 'gpsjump.csv',
  datasetId: 'a9d2479a-c6de-4dcf-a593-ad17a4f5f290',
  dashboardId: 'c9a12035-4808-4ffc-be25-11de13dab93a'
}

exports.getReport = async (user, parameters, traccar) => {
  console.log(parameters)
  const userData = await index.getUserData(user, traccar, parameters)
  const reportData = await createGPSJumpReport(
    new Date(parameters.dateRange[0]),
    new Date(parameters.dateRange[1]),
    userData,
    traccar,
    parameters.minDistance)

  return await showReport(quicksightParameters, reportData)
}
