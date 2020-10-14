const unified = require('../tado/unified')
let Characteristic, Service

class OccupancySensor {
	constructor(user, platform) {

		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic

		const userInfo = unified.userInformation(user)
		
		this.log = platform.log
		this.api = platform.api
		this.storage = platform.storage
		this.cachedState = platform.cachedState
		this.id = userInfo.id
		this.model = userInfo.model
		this.serial = userInfo.serial
		this.manufacturer = userInfo.manufacturer
		this.name = userInfo.name
		this.type = 'OccupancySensor'
		this.displayName = this.name

		if (this.id === 'anyoneSensor')
			this.state = unified.anyoneOccupancyState(this.cachedState.occupancy)
		else
			this.state = this.cachedState.occupancy[this.id] = unified.occupancyState(user)
		
		this.stateManager = require('./StateManager')(this, platform)

		this.UUID = this.api.hap.uuid.generate(this.id)
		this.accessory = platform.cachedAccessories.find(accessory => accessory.UUID === this.UUID)

		if (!this.accessory) {
			this.log(`Creating New ${platform.PLATFORM_NAME} ${this.type} Accessory for ${this.name}`)
			this.accessory = new this.api.platformAccessory(this.name, this.UUID)
			this.accessory.context.type = this.type
			this.accessory.context.userId = this.id

			platform.cachedAccessories.push(this.accessory)
			// register the accessory
			this.api.registerPlatformAccessories(platform.PLUGIN_NAME, platform.PLATFORM_NAME, [this.accessory])
		}

		this.accessory.context.userName = this.name

		let informationService = this.accessory.getService(Service.AccessoryInformation)

		if (!informationService)
			informationService = this.accessory.addService(Service.AccessoryInformation)

		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)

		this.addOccupancySensor()

	}

	addOccupancySensor() {
		this.log.easyDebug(`Adding "${this.name}" Occupancy Sensor Service`)
		this.OccupancySensorService = this.accessory.getService(Service.OccupancySensor)
		if (!this.OccupancySensorService)
			this.OccupancySensorService = this.accessory.addService(Service.OccupancySensor, this.name, this.type)

		this.OccupancySensorService.getCharacteristic(Characteristic.OccupancyDetected)
			.on('get', this.stateManager.get.OccupancyDetected)
	}


	updateHomeKit() {
		// update measurements
		this.updateValue('OccupancySensorService', 'OccupancyDetected', Characteristic.OccupancyDetected[this.state.occupancy])
	}

	updateValue (serviceName, characteristicName, newValue) {
		if (this[serviceName].getCharacteristic(Characteristic[characteristicName]).value !== newValue) {
			this[serviceName].getCharacteristic(Characteristic[characteristicName]).updateValue(newValue)
			this.log.easyDebug(`${this.name} - Updated '${characteristicName}' for ${serviceName} with NEW VALUE: ${newValue}`)
		}
	}

	
}


module.exports = OccupancySensor