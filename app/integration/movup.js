const axios = require('axios')
module.exports = async (e) => {
    await require("./sitrans")(e, 'Basic RmxlZXRyYWNrOnlZb0htR2tFN21Yag==', 'https://interop.altomovup.com/gpssignal/api/v1/data/ulog-cl')
    console.log(
        await axios.post('https://segmentado.ziyu.cl/api/restapp/gpssignal/external/', e,
            {
                headers: {
                    Username: 'Fleetrack',
                    Password: 'yYoHmGkE7mXj'
                }
            }).then(d => d.data))
}
