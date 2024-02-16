const index = require('./index')
const quicksight = require('../quicksight')
const { getPositions } = require('./index')

const dashboardId = 'c73dde2a-e6ba-43c4-aea9-452c9a844c93'
exports.getReport = async (user, parameters, traccar, axios) => {
  await index.saveToS3('temperature.csv', await createReport(user, parameters, axios))
  await quicksight.datasetIngestion('5b1ba098-e240-4b44-92b8-77f0101c8cf9')
  return quicksight.GetDashboardEmbedUrl(dashboardId)
}

async function createReport (user, { dateRange, selectedDevices }, axios) {
  selectedDevices = [selectedDevices[0]]
  return getPositions(user, { dateRange, selectedDevices }, axios)
}
