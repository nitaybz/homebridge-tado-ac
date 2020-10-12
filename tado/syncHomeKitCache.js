const AirConditioner = require('../homekit/AirConditioner')
const WeatherSensor = require('../homekit/WeatherSensor')
const OccupancySensor = require('../homekit/OccupancySensor')

module.exports = (platform) => {
	return () => {
		platform.devices.forEach(device => {

			if (!device.capabilities)
				return
			
			// Add AirConditioner
			const airConditionerIsNew = !platform.activeAccessories.find(accessory => accessory.type === 'AirConditioner' && accessory.id === device.id)
			if (airConditionerIsNew) {
				const airConditioner = new AirConditioner(device, platform)
				platform.activeAccessories.push(airConditioner)
			}
		})

			
		// Add Occupancy Sensors if enabled
		if (platform.occupancySensorsEnabled && Array.isArray(platform.users)) {
			platform.users.forEach(user => {
				const userExists = platform.activeAccessories.find(accessory => accessory.type === 'OccupancySensor' && accessory.id === user.id)
				if (!userExists) {
					const occupancySensor = new OccupancySensor(user, platform)
					platform.activeAccessories.push(occupancySensor)
				}
			})

			if (platform.anyoneSensor) {
				const anyoneSensorExists = platform.activeAccessories.find(accessory => accessory.type === 'OccupancySensor' && accessory.id === 'anyoneSensor')
				if (!anyoneSensorExists) {
					const anyoneSensor = new OccupancySensor({ id: 'anyoneSensor' }, platform)
					platform.activeAccessories.push(anyoneSensor)
				}
			}
		}


		// Add Weather Sensor if enabled
		if (platform.weatherSensorsEnabled && platform.weather) {
			const weatherExists = platform.activeAccessories.find(accessory => accessory.type === 'WeatherSensor')
			if (!weatherExists) {
				const weatherSensor = new WeatherSensor(platform)
				platform.activeAccessories.push(weatherSensor)
			}
		}

		// find devices to remove
		const accessoriesToRemove = []
		platform.cachedAccessories.forEach(accessory => {

			if (!accessory.context.type) {
				accessoriesToRemove.push(accessory)
				platform.log.easyDebug('removing old cached accessory')
			}

			let deviceExists, userExists
			switch(accessory.context.type) {
				case 'AirConditioner':
					deviceExists = platform.devices.find(device => device.id === accessory.context.deviceId)
					if (!deviceExists)
						accessoriesToRemove.push(accessory)
					break

				case 'WeatherSensor':
					if (!platform.weatherSensorsEnabled)
						accessoriesToRemove.push(accessory)
					break

				case 'OccupancySensor':
					if (!platform.occupancySensorsEnabled || !platform.users)
						accessoriesToRemove.push(accessory)
					else {
						if (accessory.context.userId === 'anyoneSensor' && platform.anyoneSensor)
							break

						userExists = platform.users.find(user => user.id === accessory.context.userId)
						if (!userExists) {
							accessoriesToRemove.push(accessory)
						}
					}
					break
			}
		})

		if (accessoriesToRemove.length) {
			platform.log.easyDebug('Unregistering Unnecessary Cached Devices:')
			platform.log.easyDebug(accessoriesToRemove)

			// unregistering accessories
			platform.api.unregisterPlatformAccessories(platform.PLUGIN_NAME, platform.PLATFORM_NAME, accessoriesToRemove)

			// remove from cachedAccessories
			platform.cachedAccessories = platform.cachedAccessories.filter( cachedAccessory => !accessoriesToRemove.find(accessory => accessory.UUID === cachedAccessory.UUID) )

			// remove from activeAccessories
			platform.activeAccessories = platform.activeAccessories.filter( activeAccessory => !accessoriesToRemove.find(accessory => accessory.UUID === activeAccessory.UUID) )
		}
	}
}