const integration = require('../integration')
exports.pushPositions = async (e) => {
    let devPosition, t
    try {
        if (e && e.body) {
            devPosition = JSON.parse(e.body)
            if (devPosition.device.attributes.integration) {
                for (const target of devPosition.device.attributes.integration.split(',')) {
                    if (integration[target]) {
                        return integration[target](devPosition)
                    } else {
                        console.warn('no integration for', devPosition.device.attributes.integration, devPosition.device.name)
                    }
                }
            } else {
                console.error('no integration', e.Body)
            }
        } else {
            console.warn('received event without data: ', e)
        }
    } catch (err) {
        const deviceName = devPosition && devPosition.device && devPosition.device.name
        const deviceId = devPosition && devPosition.device && devPosition.device.id
        console.warn('error processing', t, deviceId, deviceName, err.message, err.response && err.response.data)
        // don't send 500, it will put weight on traccar
        return { statusCode: 200 }
    }
    return { statusCode: 200 }
}
