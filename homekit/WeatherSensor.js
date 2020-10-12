const unified = require('../tado/unified')
let Characteristic, Service, FAHRENHEIT_UNIT

class WeatherSensor {
	constructor(platform) {

		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic
		FAHRENHEIT_UNIT = platform.FAHRENHEIT_UNIT

		this.log = platform.log
		this.api = platform.api
		this.storage = platform.storage
		this.cachedState = platform.cachedState
		this.id = 'Tado Weather'
		this.model = 'Tado Weather'
		this.serial = 'serial_weather'
		this.manufacturer = 'Tado GmbH'
		this.name = 'Tado Weather' 
		this.type = 'WeatherSensor'
		this.displayName = this.name
		this.usesFahrenheit = platform.usesFahrenheit

		this.state = this.cachedState.weather = unified.weatherState(platform.weather)
	
		this.stateManager = require('./StateManager')(this, platform)

		this.UUID = this.api.hap.uuid.generate(this.id)
		this.accessory = platform.cachedAccessories.find(accessory => accessory.UUID === this.UUID)

		if (!this.accessory) {
			this.log(`Creating New ${platform.PLATFORM_NAME} ${this.type} Accessory`)
			this.accessory = new this.api.platformAccessory(this.name, this.UUID)
			this.accessory.context.type = this.type

			platform.cachedAccessories.push(this.accessory)
			// register the accessory
			this.api.registerPlatformAccessories(platform.PLUGIN_NAME, platform.PLATFORM_NAME, [this.accessory])
		}

		if (platform.enableHistoryStorage) {
			const FakeGatoHistoryService = require('fakegato-history')(this.api)
			this.loggingService = new FakeGatoHistoryService('weather', this.accessory, { storage: 'fs', path: platform.persistPath })
		}


		let informationService = this.accessory.getService(Service.AccessoryInformation)

		if (!informationService)
			informationService = this.accessory.addService(Service.AccessoryInformation)

		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)
			.setCharacteristic(Characteristic.AppMatchingIdentifier, this.appId)

		this.addTemperatureSensor()
		this.addLightBulb()

	}

	addTemperatureSensor() {
		this.log.easyDebug(`Adding TemperatureSensor Service`)
		this.TemperatureSensorService = this.accessory.getService(Service.TemperatureSensor)
		if (!this.TemperatureSensorService)
			this.TemperatureSensorService = this.accessory.addService(Service.TemperatureSensor, 'Outside Temperature', 'TemperatureSensor')

		this.TemperatureSensorService.getCharacteristic(Characteristic.CurrentTemperature)
			.setProps({
				minValue: -100,
				maxValue: 100,
				minStep: 0.1
			})
			.on('get', this.stateManager.get.OutsideTemperature)
	}


	addLightBulb() {
		this.log.easyDebug(`Adding Solar Light Bulb Service`)
		this.SolarSensor = this.accessory.getService(Service.Lightbulb)
		if (!this.SolarSensor)
			this.SolarSensor = this.accessory.addService(Service.Lightbulb, 'Solar Intensity', 'SolarSensor')

		this.SolarSensor.getCharacteristic(Characteristic.On)
			.on('get', this.stateManager.get.SolarOn)
			.on('set', this.stateManager.set.SolarOn)

		this.SolarSensor.getCharacteristic(Characteristic.Brightness)
				.setProps({
						maxValue: 100,
						minValue: 0,
						minStep: 1
				})
				.on('get', this.stateManager.get.SolarBrightness)
				.on('set', this.stateManager.set.SolarBrightness)
	}


	updateHomeKit() {
		// log new state with FakeGato
		if (this.loggingService) {
			this.loggingService.addEntry({
				time: Math.floor((new Date()).getTime()/1000),
				temp: this.state.currentTemperature,
			})
		}
		
		this.updateValue('TemperatureSensorService', 'CurrentTemperature', this.state.outsideTemperature)
		this.updateValue('SolarSensor', 'On', !!this.state.solarIntensity)
		this.updateValue('SolarSensor', 'Brightness', this.state.solarIntensity)

		// cache last state to storage
		this.storage.setItem('state', this.cachedState)
	}

	updateValue (serviceName, characteristicName, newValue) {
		if (this[serviceName].getCharacteristic(Characteristic[characteristicName]).value !== newValue) {
			this[serviceName].getCharacteristic(Characteristic[characteristicName]).updateValue(newValue)
			this.log.easyDebug(`${this.roomName} - Updated '${characteristicName}' for ${serviceName} with NEW VALUE: ${newValue}`)
		}
	}

	
}


module.exports = WeatherSensor