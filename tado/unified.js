function fanLevelToHK(value, fanLevels) {
	if (value === 'AUTO')
		return 0

	fanLevels = fanLevels.filter(level => level !== 'AUTO')
	const totalLevels = fanLevels.length
	const valueIndex = fanLevels.indexOf(value) + 1
	return Math.round(100 * valueIndex / totalLevels)
}

function HKToFanLevel(value, fanLevels) {

	let selected = 'AUTO'
	if (!fanLevels.includes('AUTO'))
		selected = fanLevels[0]

	if (value !== 0) {
		fanLevels = fanLevels.filter(level => level !== 'AUTO')
		const totalLevels = fanLevels.length
		for (let i = 0; i < fanLevels.length; i++) {
			if (value <= (100 * (i + 1) / totalLevels))	{
				selected = fanLevels[i]
				break
			}
		}
	}
	return selected
}

function toFahrenheit(value) {
	return Math.round((value * 1.8) + 32)
}


function toCelsius(value) {
	return (value - 32) / 1.8
}

module.exports = {

	deviceInformation: device => {
		return {
			id: device.id,
			model: device.devices[0].deviceType,
			serial: device.devices[0].serialNo,
			manufacturer: 'tado GmbH',
			appId: 'com.tado.tadoapp',
			roomName: device.name,
			temperatureUnit: device.temperatureUnit,
			filterService: false,
			installation: device.installation
		}
	},

	userInformation: user => {
		if (user.id === 'anyoneSensor')
			return {
				id: 'anyoneSensor',
				name: 'Anyone',
				model: 'anyoneSensor',
				serial: '101010',
				manufacturer: 'tado GmbH',
				appId: 'com.tado.tadoapp'
			}

		const mobileDevice = user.mobileDevices.find(device => device.settings.geoTrackingEnabled)
		return {
			id: user.id,
			name: user.name,
			model: mobileDevice.name,
			serial: mobileDevice.id,
			manufacturer: 'tado GmbH',
			appId: 'com.tado.tadoapp'
		}
	},

	capabilities: device => {

		const capabilities = {}

		for (const [key, modeCapabilities] of Object.entries(device.capabilities)) {

			// Mode options are COOL, HEAT, AUTO, FAN, DRY
			const mode = key.toUpperCase()

			if (!['COOL', 'HEAT', 'AUTO', 'FAN', 'DRY'].includes(mode))
				continue

			capabilities[mode] = {}

			// set temperatures min & max
			if (['COOL', 'HEAT', 'AUTO'].includes(mode) && modeCapabilities.temperatures && modeCapabilities.temperatures.celsius) {
				capabilities[mode].temperatures = {
					CELSIUS: {
						min: modeCapabilities.temperatures.celsius.min,
						max: modeCapabilities.temperatures.celsius.max
					},
					FAHRENHEIT: {
						min: modeCapabilities.temperatures.fahrenheit.min,
						max: modeCapabilities.temperatures.fahrenheit.max
					}
				}
			}

			// set fanSpeeds
			if (modeCapabilities.fanSpeeds && modeCapabilities.fanSpeeds.length) {
				capabilities[mode].fanSpeeds = modeCapabilities.fanSpeeds.reverse()

				// set AUTO fanSpeed
				if (capabilities[mode].fanSpeeds.includes('AUTO'))
					capabilities[mode].autoFanSpeed = true
				else
					capabilities[mode].autoFanSpeed = false
				
			}

			// set swing
			if (modeCapabilities.swings) {
				capabilities[mode].swing = true
			}

		}

		return capabilities
	},

	acState: (device) => {

		const state = {
			active: (device.state.setting.power === 'ON'),
			mode: device.state.setting.mode || 'OFF',
			targetTemperature: device.state.setting.temperature ? device.state.setting.temperature.celsius : null,
			currentTemperature: device.state.sensorDataPoints.insideTemperature.celsius,
			relativeHumidity: device.state.sensorDataPoints.humidity.percentage,
			tadoMode: device.state.overlayType,
			manualControl: !!device.state.overlay
		}

		const modeCapabilities = device.capabilities[state.mode]

		state.swing = (!modeCapabilities.swing || state.mode === 'OFF' || !device.state.setting.swing || device.state.setting.swing === 'OFF') ?
			'SWING_DISABLED' : 'SWING_ENABLED'

		state.swing = (!modeCapabilities.fanSpeeds || state.mode === 'OFF' || !device.state.setting.fanSpeed) ? 
			0 : fanLevelToHK(device.state.setting.fanSpeed, modeCapabilities.fanSpeeds.reverse())


		return state
	},


	weatherState: weather => {

		const state = {
			outsideTemperature: weather.outsideTemperature.celsius,
			solarIntensity: weather.solarIntensity.percentage
		}

		return state
	},

	occupancyState: user => {
		const mobileDevice = user.mobileDevices.find(device => device.settings.geoTrackingEnabled)
		const state = {
			occupancy: (mobileDevice && mobileDevice.location.atHome) ? 'OCCUPANCY_DETECTED' : 'OCCUPANCY_NOT_DETECTED'
		}

		return state
	},


	anyoneOccupancyState: allUsersStates => {
		const occupied = Object.values(allUsersStates).find(user => user.occupancy === 'OCCUPANCY_DETECTED')
		const state = {
			occupancy: occupied ? 'OCCUPANCY_DETECTED' : 'OCCUPANCY_NOT_DETECTED'
		}

		return state
	},

	tadoOverlay: (platform, device, state) => {

		const overlay = {
			termination: {
					type: platform.tadoMode
			},
			setting: {
				type: 'AIR_CONDITIONING',
				power: state.active ? 'ON' : 'OFF'
			}
		}

		// returning off state
		if (!state.active)
			return overlay

		
		overlay.setting.mode = state.mode

		// add temperatures to heat and cool
		if (['HEAT', 'COOL'].includes(state.mode)) {
			overlay.setting.temperature = {
				fahrenheit: toFahrenheit(state.targetTemperature),
				celsius: state.targetTemperature
			}
		}

		if ('swing' in device.capabilities[state.mode])
			overlay.setting.swing = state.swing === 'SWING_ENABLED' ? 'ON' : 'OFF'

		if ('fanSpeeds' in device.capabilities[state.mode])
			overlay.setting.swing = state.swing === 'SWING_ENABLED' ? 'ON' : 'OFF'
			overlay.setting.fanSpeed = HKToFanLevel(state.fanSpeed, device.capabilities[state.mode].fanSpeeds)

		if (platform.tadoMode == 'TIMER')
			overlay.termination.durationInSeconds = platform.durationInMinutes * 60

		return overlay
	}
}