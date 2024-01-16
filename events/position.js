const event = {
    body: JSON.stringify({
        device: {
            uniqueId: '865826043498700',
            name: 'GBF0I18',
            attributes: {
                integration: 'sitrans',
                cnpj: '20529021000106',
                notes: '0005639243',
                license_plate: 'AA-BB-00'
            }
        },
        position: {
            serverTime: new Date(),
            fixTime: new Date(),
            latitude: -23.67264175415039,
            longitude: -52.63001251220703,
            course: 1.1,
            speed: 1.1,
            attributes: {
                hdop: 1,
                sat: 0,
                totalDistance: 10000,
                ignition: 1,
                driverUniqueId: '94503143947'
            }
        }
    })
}
