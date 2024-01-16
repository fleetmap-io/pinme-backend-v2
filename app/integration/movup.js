const axios = require('axios')
module.exports = async (e) => {
    await require("./sitrans")(e, 'Basic RmxlZXRyYWNrOnlZb0htR2tFN21Yag==', 'https://interop.altomovup.com/gpssignal/api/v1/data/ulog-cl')

    const data = {
        lng: e.position.longitude,
        lat: e.position.latitude,
        altitude: e.position.altitude,
        ignition: e.position.ignition,
        speed: e.position.speed,
        num_plate: e.device.license_plate,
        provider: 'Fleetrack',
        gps_id: e.device.id,
        date_time: e.position.fixTime
    }
    console.log(data,
        await axios.post('https://segmentado.ziyu.cl/api/restapp/gpssignal/external/', data,
            {
                headers: {
                    Username: 'Fleetrack',
                    Password: 'yYoHmGkE7mXj'
                }
            }).then(d => d.data))
}
