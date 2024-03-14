function _sendMedLog (devPosition) {
    const device = devPosition.device
    const position = devPosition.position
    const args = {
      Cliente: {
        pUser: 'wsCargoFrio',
        pPassword: '$$Cargo.Frio20',
        pImei: device.uniqueId,
        pFHActividad: moment(position.fixTime).tz('America/Santiago').format('YYYYMMDD HH:mm:ss'),
        pLatitud: position.latitude,
        pLongitud: position.longitude,
        pVelocidad: Math.round(position.speed * 1.852),
        pIngnicion: position.ignition ? 1 : 0,
        pUbicacion: position.address,
        pNum_Actividad: 1,
        pCod_Flota: 1,
        pNomFlota: device.groupName ? device.groupName : '',
        pCod_Unidad: 1,
        pNomUnidad: device.name,
        pCod_Asignado: 1,
        pNomAsignado: 1,
        pVelocidadMaxima: 1,
        pOdometro: 1,
        pDistanciaViaje: 1,
        pDistanciaIncremental: 1,
        pCod_TipoEvento: 1,
        pTipoEvento: 1,
        pNomTipoEvento: 1,
        pPuerto: 1,
        pHDOP: 1,
        pNumSatelites: 1,
        pHdg: position.course,
        pDatosExtendidos: 1
      }
    }
    console.log(args)
    return mClient.WM_INS_DATAGPSAsync(args, { timeout: timeout })
  }

  
  module.exports = async (devPosition) => {
    if (mClient === null) {
      mClient = await soap.createClientAsync(urlMedLog, wsdlOptions)
    } else {
      return _sendMedLog(devPosition)
    }
  }