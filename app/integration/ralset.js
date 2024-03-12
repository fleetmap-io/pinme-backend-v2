const net = require('net')
const axios = require('axios')

module.exports = async (e) => {
  console.log('ralset integration', e)
  console.log('ralset integration', await axios.get('https://checkip.amazonaws.com/').then(d => d.data))
  const start = new Date()
  try {
    // let ip = await axios.get('https://checkip.amazonaws.com').then(d => d.data)
    await new Promise((resolve, reject) => {
      const client = new net.Socket()
      client.connect(9306, '37.18.240.36', () => {
        const data = JSON.stringify({
          event: {
            ...e.position,
            ...e.device,
            ...e.event
          }
        })
        console.log('ralset', data, client.write(data))
      })

      client.on('data', (data) => {
        console.log('received', data)
        client.destroy()
        resolve()
      })

      client.on('close', function () {
        console.log('Connection closed')
        resolve()
      })
      setTimeout(() => reject(new Error('manual timeout')), 10000)
    })
  } catch (ex) {
    console.error('ralset', ex.message, new Date() - start, e.event)
  }
}
