const { addPermission, deletePermission } = require('./api/traccar')
exports.post = async (body) => {
  return await addPermission(body)
}

exports.delete = async (body) => {
  return await deletePermission(body)
}
