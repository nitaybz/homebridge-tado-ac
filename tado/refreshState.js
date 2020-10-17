const unified = require('./unified')

module.exports = (platform) => {
	return {
		ac: () => {
			if (!platform.processingState && !platform.setProcessing) {
				platform.processingState = true
				clearTimeout(platform.pollingTimeout)
				setTimeout(async () => {

					try {
						platform.devices = await platform.tadoApi.getAllDevices()
						await platform.storage.setItem('tado-devices', platform.devices)
						
					} catch(err) {
						platform.log.easyDebug('<<<< ---- Refresh State FAILED! ---- >>>>')
						platform.processingState = false
						if (platform.pollingInterval) {
							platform.log.easyDebug(`Will try again in ${platform.pollingInterval/1000} seconds...`)
							platform.pollingTimeout = setTimeout(platform.refreshState.ac, platform.pollingInterval)
						}
						return
					}
					if (platform.setProcessing) {
						platform.processingState = false
						return
					}
					
					platform.devices.forEach(device => {
						const airConditioner = platform.activeAccessories.find(accessory => accessory.type === 'AirConditioner' && accessory.id === device.id)

						if (airConditioner) {
							// Update AC state in cache + HomeKit
							airConditioner.state.update(unified.acState(device))
						}
					})



					// register new devices / unregister removed devices
					platform.syncHomeKitCache()

					// start timeout for next polling
					if (platform.pollingInterval)
						platform.pollingTimeout = setTimeout(platform.refreshState.ac, platform.pollingInterval)

					// block new requests for extra 5 seconds
					setTimeout(() => {
						platform.processingState = false
					}, 5000)

				}, platform.refreshDelay)
			}
		},
		
		weather: async () => {
			try {
				platform.weather = await platform.tadoApi.getWeather()
				
			} catch(err) {
				platform.log.easyDebug('<<<< ---- Refresh Weather State FAILED! ---- >>>>')
				platform.log.easyDebug(`Will try again in ${platform.weatherPollingInterval/1000} seconds...`)
				return
			}

			await platform.storage.setItem('weather', platform.weather)
			const weatherSensor = platform.activeAccessories.find(accessory => accessory.type === 'WeatherSensor')
			if (weatherSensor) {
				weatherSensor.state = platform.cachedState.weather = unified.weatherState(platform.weather)
				weatherSensor.updateHomeKit()
			}
			

		},

		occupancy: async () => {
			try {
				platform.users = await platform.tadoApi.getUsers()
				
			} catch(err) {
				platform.log.easyDebug('<<<< ---- Refresh Weather State FAILED! ---- >>>>')
				platform.log.easyDebug(`Will try again in ${platform.weatherPollingInterval/1000} seconds...`)
				return
			}

			await platform.storage.setItem('users', platform.users)

			platform.users.forEach(user => {
				const occupancySensor = platform.activeAccessories.find(accessory => accessory.type === 'OccupancySensor' && user.id === accessory.id)
				if (occupancySensor) {
					occupancySensor.state = platform.cachedState.occupancy[user.id] = unified.occupancyState(user)
					occupancySensor.updateHomeKit()
				}
			})
			
			if (platform.anyoneSensor) {
				const anyoneSensor = platform.activeAccessories.find(accessory => accessory.type === 'OccupancySensor' && accessory.id === 'anyoneSensor')
				if (anyoneSensor) {
					anyoneSensor.state = unified.anyoneOccupancyState(platform.cachedState.occupancy)
					anyoneSensor.updateHomeKit()
				}
			}

			platform.syncHomeKitCache()
		}
	}

}