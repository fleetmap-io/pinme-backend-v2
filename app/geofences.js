const { execute } = require('./mysql')

exports.deleteGeofences = async (geofences) => {
  if (geofences.length) {
    const query = `delete
                   from tc_geofences
                   where id in (${geofences.join(',')})`
    console.log(query)
    await execute(query)
  }
}
