const index = require('./index')
const { createPerformanceReport } = require('fleetmap-reports/src/partnerReports/performance-report')
const quicksight = require('../quicksight')

const quicksightParameters = {
  singleDevice: {
    csvName: 'performanceSingleDevice.csv',
    datasetId: '83210fe0-66c6-4ebe-a21b-2ee034bbbbd7',
    dashboardId: '08dc82ef-72db-4d02-bf10-1242fbbafd99'
  },
  multipleDevice: {
    csvName: 'performance.csv',
    datasetId: 'fa41a74a-51d2-498e-990b-7102bc67674f',
    dashboardId: '2b5b4cc1-0f09-4002-b167-f1a00016533a'
  }
}

exports.getReport = async (user, parameters, traccar) => {
  console.log(parameters)
  const userData = await index.getUserData(user, traccar, parameters)
  const reportData = await createPerformanceReport(new Date(parameters.dateRange[0]),
    new Date(parameters.dateRange[1]), userData, traccar)
  if (userData.devices.length === 1) {
    return await showReport(quicksightParameters.singleDevice, reportData)
  } else {
    return await showReport(quicksightParameters.multipleDevice, reportData)
  }
}

async function showReport (quicksightIds, reportData) {
  await index.saveToS3(quicksightIds.csvName, reportData)
  await quicksight.datasetIngestion(quicksightIds.datasetId)
  return quicksight.GetDashboardEmbedUrl(quicksightIds.dashboardId)
}

exports.showReport = showReport
