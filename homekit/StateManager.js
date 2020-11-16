let Characteristic


function toFahrenheit(value) {
	if (isNaN(value))
		return null
	return Math.round((value * 1.8) + 32)
}

function characteristicToMode(characteristic) {
	switch (characteristic) {
		case Characteristic.TargetHeaterCoolerState.COOL:
			return 'COOL'
		case Characteristic.TargetHeaterCoolerState.HEAT:
			return 'HEAT'
		case Characteristic.TargetHeaterCoolerState.AUTO:
			return 'AUTO'
	}

}

function ThermostatCharacteristicToMode(characteristic) {
	switch (characteristic) {
		case Characteristic.TargetHeatingCoolingState.COOL:
			return 'COOL'
		case Characteristic.TargetHeatingCoolingState.HEAT:
			return 'HEAT'
		case Characteristic.TargetHeatingCoolingState.AUTO:
			return 'AUTO'
		case Characteristic.TargetHeatingCoolingState.OFF:
			return 'OFF'
	}

}

module.exports = (device, platform) => {
	Characteristic = platform.api.hap.Characteristic
	const log = platform.log

	return {

		get: {
			ACActive: (callback) => {
				const active = device.state.active
				const mode = device.state.mode
		
				if (!active || mode === 'FAN' || mode === 'DRY') {
					log.easyDebug(device.name, '(GET) - AC Active State: false')
					callback(null, 0)
				} else {
					log.easyDebug(device.name, '(GET) - AC Active State: true')
					callback(null, 1)
				}
			},

			CurrentHeaterCoolerState: (callback) => {
				const active = device.state.active
				const mode = device.state.mode
				const targetTemp = device.state.targetTemperature
				const currentTemp = device.state.currentTemperature
		
				log.easyDebug(device.name, '(GET) - Current HeaterCooler State is:', active ? mode : 'OFF')
				
				if (!active || mode === 'FAN' || mode === 'DRY')
					callback(null, Characteristic.CurrentHeaterCoolerState.INACTIVE)
				else if (mode === 'COOL')
					callback(null, Characteristic.CurrentHeaterCoolerState.COOLING)
				else if (mode === 'HEAT')
					callback(null, Characteristic.CurrentHeaterCoolerState.HEATING)
				else if (currentTemp > targetTemp)
					callback(null, Characteristic.CurrentHeaterCoolerState.COOLING)
				else
					callback(null, Characteristic.CurrentHeaterCoolerState.HEATING)
			},

			CurrentHeatingCoolingState: (callback) => {
				const active = device.state.active
				const mode = device.state.mode
				const targetTemp = device.state.targetTemperature || 20
				const currentTemp = device.state.currentTemperature
		
				log.easyDebug(device.name, '(GET) - Current HeatingCooling State is:', active ? mode : 'OFF')
				
				if (!active || mode === 'FAN' || mode === 'DRY')
					callback(null, Characteristic.CurrentHeatingCoolingState.OFF)
				else if (mode === 'COOL')
					callback(null, Characteristic.CurrentHeatingCoolingState.COOL)
				else if (mode === 'HEAT')
					callback(null, Characteristic.CurrentHeatingCoolingState.HEAT)
				else if (currentTemp >= targetTemp)
					callback(null, Characteristic.CurrentHeatingCoolingState.COOL)
				else
					callback(null, Characteristic.CurrentHeatingCoolingState.HEAT)
			},

		
			TargetHeaterCoolerState: (callback) => {
				const active = device.state.active
				const mode = device.state.mode
		
				log.easyDebug(device.name, '(GET) - Target HeaterCooler State is:', active ? mode : 'OFF')
				if (!active || mode === 'FAN' || mode === 'DRY') {
					const lastMode = device.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).value
					callback(null, lastMode)
				} else
					callback(null, Characteristic.TargetHeaterCoolerState[mode])
			},

			TargetHeatingCoolingState: (callback) => {
				const active = device.state.active
				const mode = device.state.mode
		
				log.easyDebug(device.name, '(GET) - Target HeatingCooling State is:', active ? mode : 'OFF')
				if (!active || mode === 'FAN' || mode === 'DRY')
					callback(null, Characteristic.TargetHeaterCoolerState.OFF)
				else {
					device.accessory.context.lastMode = mode
					callback(null, Characteristic.TargetHeaterCoolerState[mode])
				}
			},

			CurrentTemperature: (callback) => {
				const currentTemp = device.state.currentTemperature
				if (device.usesFahrenheit)
					log.easyDebug(device.name, '(GET) - Current Temperature is:', toFahrenheit(currentTemp) + 'ºF')
				else
					log.easyDebug(device.name, '(GET) - Current Temperature is:', currentTemp + 'ºC')

				callback(null, currentTemp)
			},

			CoolingThresholdTemperature: (callback) => {
				const targetTemp = device.state.targetTemperature

				if (device.usesFahrenheit)
					log.easyDebug(device.name, '(GET) - Target Cooling Temperature is:', toFahrenheit(targetTemp) + 'ºF')
				else
					log.easyDebug(device.name, '(GET) - Target Cooling Temperature is:', targetTemp + 'ºC')

				callback(null, targetTemp || device.state.currentTemperature)
			},
			
			HeatingThresholdTemperature: (callback) => {
				const targetTemp = device.state.targetTemperature

				if (device.usesFahrenheit)
					log.easyDebug(device.name, '(GET) - Target Heating Temperature is:', toFahrenheit(targetTemp) + 'ºF')
				else
					log.easyDebug(device.name, '(GET) - Target Heating Temperature is:', targetTemp + 'ºC')

				callback(null, targetTemp || device.state.currentTemperature)
			},


			TargetTemperature: (callback) => {
				const targetTemp = device.state.targetTemperature

				if (device.usesFahrenheit)
					log.easyDebug(device.name, '(GET) - Target Heating Temperature is:', toFahrenheit(targetTemp) + 'ºF')
				else
					log.easyDebug(device.name, '(GET) - Target Heating Temperature is:', targetTemp + 'ºC')

				callback(null, targetTemp || device.state.currentTemperature)
			},

			TemperatureDisplayUnits: (callback) => {
				log.easyDebug(device.name, '(GET) - Temperature Display Units is:', device.temperatureUnit)
				callback(null, device.usesFahrenheit ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS)
			},

			CurrentRelativeHumidity: (callback) => {
				log.easyDebug(device.name, '(GET) - Current Relative Humidity is:', device.state.relativeHumidity, '%')
				callback(null, device.state.relativeHumidity)
			},

			ACSwing: (callback) => {
				const swing = device.state.swing

				log.easyDebug(device.name, '(GET) - AC Swing is:', swing)

				callback(null, Characteristic.SwingMode[swing])
			},

			ACRotationSpeed: (callback) => {
				const fanSpeed = device.state.fanSpeed

				log.easyDebug(device.name, '(GET) - AC Rotation Speed is:', fanSpeed + '%')
				callback(null, fanSpeed)
			},

			// FAN
			FanActive: (callback) => {
				const active = device.state.active
				const mode = device.state.mode
		
				if (!active || mode !== 'FAN') {
					log.easyDebug(device.name, '(GET) - Fan Active State: false')
					callback(null, 0)
				} else {
					log.easyDebug(device.name, '(GET) - Fan Active State: true')
					callback(null, 1)
				}
			},

			FanSwing: (callback) => {
				const swing = device.state.swing

				log.easyDebug(device.name, '(GET) - Fan Swing is:', swing)

				callback(null, Characteristic.SwingMode[swing])
			},

			FanRotationSpeed: (callback) => {
				const fanSpeed = device.state.fanSpeed

				log.easyDebug(device.name, '(GET) - Fan Rotation Speed is:', fanSpeed + '%')
				callback(null, fanSpeed)
			},

			// DEHUMIDIFIER
			DryActive: (callback) => {
				const active = device.state.active
				const mode = device.state.mode
		
				if (!active || mode !== 'DRY') {
					log.easyDebug(device.name, '(GET) - Dry Active State: false')
					callback(null, 0)
				} else {
					log.easyDebug(device.name, '(GET) - Dry Active State: true')
					callback(null, 1)
				}
			},

			CurrentHumidifierDehumidifierState: (callback) => {
				const active = device.state.active
				const mode = device.state.mode
		
				if (!active || mode !== 'DRY') {
					log.easyDebug(device.name, '(GET) - Dry Current Dehumidifier State: INACTIVE')
					callback(null, Characteristic.CurrentHumidifierDehumidifierState.INACTIVE)
				} else {
					log.easyDebug(device.name, '(GET) - Dry Current Dehumidifier State: DEHUMIDIFYING')
					callback(null, Characteristic.CurrentHumidifierDehumidifierState.DEHUMIDIFYING)
				}
			},

			TargetHumidifierDehumidifierState: (callback) => {
				callback(null, Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER)
			},

			DryRotationSpeed: (callback) => {
				const fanSpeed = device.state.fanSpeed

				log.easyDebug(device.name, '(GET) - Dry Rotation Speed is:', fanSpeed + '%')
				callback(null, fanSpeed)
			},

			DrySwing: (callback) => {
				const swing = device.state.swing

				log.easyDebug(device.name, '(GET) - Dry Swing is:', swing)

				callback(null, Characteristic.SwingMode[swing])
			},

			// MANUAL CONTROL

			ManualControl: (callback) => {
				const manualControl = device.state.manualControl
				log.easyDebug(device.name, '(GET) - Manual Control is:', manualControl)
				callback(null, manualControl)
			},

			// OCCUPANCY SENSOR

			OccupancyDetected: (callback) => {
				const occupancy = device.state.occupancy
				log.easyDebug(device.name, '(GET) - is:', occupancy)
				callback(null, Characteristic.OccupancyDetected[occupancy])
			},

			// WEATHER

			OutsideTemperature: (callback) => {
				const outsideTemperature = device.state.outsideTemperature
				log.easyDebug('Outside Temperature is:', outsideTemperature)
				callback(null, outsideTemperature)
			},

			SolarLightLevel: (callback) => {
				const solarIntensity = device.state.solarIntensity
				log.easyDebug('Solar Intensity is:', solarIntensity)
				callback(null, solarIntensity)
			}
		
		},
	
		set: {

			ACActive: (state, callback) => {
				state = !!state
				log.easyDebug(device.name + ' -> Setting AC state Active:', state)

				if (state) {
					device.state.active = true
					const lastMode = device.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).value
					const mode = characteristicToMode(lastMode)
					log.easyDebug(device.name + ' -> Setting Mode to', mode)
					device.state.mode = mode
				} else if (device.state.mode === 'COOL' || device.state.mode === 'HEAT' || device.state.mode === 'AUTO')
					device.state.active = false

				callback()
			},
		
		
			TargetHeaterCoolerState: (state, callback) => {
				const mode = characteristicToMode(state)
				log.easyDebug(device.name + ' -> Setting Target HeaterCooler State:', mode)
				device.state.mode = mode
				device.state.active = true

				callback()
			},

			TargetHeatingCoolingState: (state, callback) => {
				
				const mode = ThermostatCharacteristicToMode(state)
				log.easyDebug(device.name + ' -> Setting Target HeatingCooling State:', mode)
				device.state.mode = mode
				device.state.active = (mode !== 'OFF')

				if (['COOL', 'HEAT', 'AUTO'].includes(mode))
					device.accessory.context.lastMode = mode

				callback()
			},
		
			CoolingThresholdTemperature: (temp, callback) => {
				if (device.usesFahrenheit)
					log.easyDebug(device.name + ' -> Setting Cooling Threshold Temperature:', toFahrenheit(temp) + 'ºF')
				else
					log.easyDebug(device.name + ' -> Setting Cooling Threshold Temperature:', temp + 'ºC')

				device.state.active = true
				const lastMode = device.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).value
				const mode = characteristicToMode(lastMode)
				if (mode !== 'AUTO') {
					device.state.targetTemperature = temp
					log.easyDebug(device.name + ' -> Setting Mode to: COOL')
					device.state.mode = 'COOL'
				} else {
					if (device.state.targetTemperature !== temp) {
						setTimeout(() => {
							device.state.targetTemperature = temp
							log.easyDebug(device.name + ' -> Setting Mode to: AUTO')
							device.state.mode = 'AUTO'
						},100)
					}
				}
				callback()
			},
		
			HeatingThresholdTemperature: (temp, callback) => {
				if (device.usesFahrenheit)
					log.easyDebug(device.name + ' -> Setting Heating Threshold Temperature:', toFahrenheit(temp) + 'ºF')
				else
					log.easyDebug(device.name + ' -> Setting Heating Threshold Temperature:', temp + 'ºC')


				device.state.active = true
				const lastMode = device.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).value
				const mode = characteristicToMode(lastMode)
				if (mode !== 'AUTO') {
					device.state.targetTemperature = temp
					log.easyDebug(device.name + ' -> Setting Mode to: HEAT')
					device.state.mode = 'HEAT'
				} else {
					if (device.state.targetTemperature !== temp) {
						setTimeout(() => {
							device.state.targetTemperature = temp
							log.easyDebug(device.name + ' -> Setting Mode to: AUTO')
							device.state.mode = 'AUTO'
						},100)
					}
				}
				callback()
			},

			TargetTemperature: (temp, callback) => {
				if (device.usesFahrenheit)
					log.easyDebug(device.name + ' -> Setting Target Temperature:', toFahrenheit(temp) + 'ºF')
				else
					log.easyDebug(device.name + ' -> Setting Target Temperature:', temp + 'ºC')

				device.state.active = true
				const lastMode = device.accessory.context.lastMode
				device.state.targetTemperature = temp
				log.easyDebug(`${device.name} -> Setting Mode to: ${lastMode}`)
				device.state.mode = lastMode
				callback()
			},
		
			ACSwing: (state, callback) => {
				
				state = state === Characteristic.SwingMode.SWING_ENABLED ? 'SWING_ENABLED' : 'SWING_DISABLED'
				log.easyDebug(device.name + ' -> Setting AC Swing:', state)
				device.state.swing = state

				const lastMode = device.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).value
				const mode = characteristicToMode(lastMode)
				log.easyDebug(device.name + ' -> Setting Mode to', mode)
				device.state.active = true
				device.state.mode = mode

				callback()
			},
		
			ACRotationSpeed: (speed, callback) => {
				log.easyDebug(device.name + ' -> Setting AC Rotation Speed:', speed + '%')
				device.state.fanSpeed = speed

				const lastMode = device.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).value
				const mode = characteristicToMode(lastMode)
				log.easyDebug(device.name + ' -> Setting Mode to', mode)
				device.state.active = true
				device.state.mode = mode

				callback()
			},

			// FAN

			FanActive: (state, callback) => {
				state = !!state
				log.easyDebug(device.name + ' -> Setting Fan state Active:', state)
				if (state) {
					device.state.active = true
					log.easyDebug(device.name + ' -> Setting Mode to: FAN')
					device.state.mode = 'FAN'
				} else if (device.state.mode === 'FAN')
					device.state.active = false
				callback()
			},
		
			FanSwing: (state, callback) => {
				state = state === Characteristic.SwingMode.SWING_ENABLED ? 'SWING_ENABLED' : 'SWING_DISABLED'
				log.easyDebug(device.name + ' -> Setting Fan Swing:', state)
				device.state.swing = state

				device.state.active = true
				log.easyDebug(device.name + ' -> Setting Mode to: FAN')
				device.state.mode = 'FAN'
				callback()
			},
		
			FanRotationSpeed: (speed, callback) => {
				log.easyDebug(device.name + ' -> Setting Fan Rotation Speed:', speed + '%')
				device.state.fanSpeed = speed

				device.state.active = true
				log.easyDebug(device.name + ' -> Setting Mode to: FAN')
				device.state.mode = 'FAN'
				callback()
			},
		
			// DEHUMIDIFIER

			DryActive: (state, callback) => {
				state = !!state
				log.easyDebug(device.name + ' -> Setting Dry state Active:', state)
				if (state) {
					device.state.active = true
					log.easyDebug(device.name + ' -> Setting Mode to: DRY')
					device.state.mode = 'DRY'
				} else if (device.state.mode === 'DRY')
					device.state.active = false
				callback()
			},
		
			TargetHumidifierDehumidifierState: (state, callback) => {
				device.state.active = true
				log.easyDebug(device.name + ' -> Setting Mode to: DRY')
				device.state.mode = 'DRY'
				callback()
			},
		
			DrySwing: (state, callback) => {
				state = state === Characteristic.SwingMode.SWING_ENABLED ? 'SWING_ENABLED' : 'SWING_DISABLED'
				log.easyDebug(device.name + ' -> Setting Dry Swing:', state)
				device.state.swing = state

				device.state.active = true
				log.easyDebug(device.name + ' -> Setting Mode to: DRY')
				device.state.mode = 'DRY'
				callback()
			},
		
			DryRotationSpeed: (speed, callback) => {
				log.easyDebug(device.name + ' -> Setting Dry Rotation Speed:', speed + '%')
				device.state.fanSpeed = speed

				device.state.active = true
				log.easyDebug(device.name + ' -> Setting Mode to: DRY')
				device.state.mode = 'DRY'
				callback()
			},

			// MANUAL CONTROL

			ManualControl: (state, callback) => {
				log.easyDebug(device.name + ' -> Setting Manual Control:', state)
				device.state.manualControl = state
				callback()
			}
		}

	}
}