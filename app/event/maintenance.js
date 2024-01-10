const traccar = require("../api/traccar")
const auth = require("../auth")
const notifications = require("./notifications")

async function checkMaintenances() {
    const maintenances = await traccar.getAllMaintenances()
    const periodTypeMaintenances = maintenances.filter(m => m.type === 'period')

    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    for (const m of periodTypeMaintenances) {
        try {
            const nextMaintenanceDate = getNextMaintenanceDate(m)
            console.log(m.name, new Date(m.start).toLocaleDateString(), m.period, nextMaintenanceDate.toLocaleDateString())
            if (nextMaintenanceDate.getTime() === currentDate.getTime()
                && (!m.attributes.lastSent || new Date(m.attributes.lastSent).getTime() !== nextMaintenanceDate.getTime())) {
                //next maintenance is today
                await createMaintenanceEvent(m, nextMaintenanceDate)
            }
        } catch (e) {
            console.error(e)
        }
    }
}

async function createMaintenanceEvent(maintenance, nextMaintenanceDate) {
    const data = await traccar.getUser(maintenance.attributes.userId)
    const responseDevices = await traccar.getDevicesByUserId(data.id)
    const devices = responseDevices.data.filter(d => !d.disabled)

    await auth.getUserSession(data.email)
    for (const device of devices) {
        const deviceMaintenances = await traccar.getMaintenancesByDevice(device.id)
        if (deviceMaintenances.find(m => m.id === maintenance.id)) {
            console.log("Create Event")
            const event = {
                device: device,
                event: {
                    type: 'maintenance',
                    maintenance: maintenance,
                    attributes: {
                        maintenanceDate: nextMaintenanceDate
                    }
                },
                users: [data]
            }
            await notifications.processEvent(event)
        }
    }

    maintenance.attributes.lastSent = nextMaintenanceDate
    await traccar.updateMaintenance(maintenance)
}

function getNextMaintenanceDate(maintenance) {
    const currentDate = new Date()
    currentDate.setHours(0, 0, 0, 0)

    const nextMaintenanceDate = new Date(maintenance.start)
    nextMaintenanceDate.setHours(0, 0, 0, 0)

    while (nextMaintenanceDate.getTime() < currentDate.getTime()) {
        nextMaintenanceDate.setMonth(nextMaintenanceDate.getMonth() + maintenance.period)
    }

    return nextMaintenanceDate
}

exports.checkMaintenances = checkMaintenances
