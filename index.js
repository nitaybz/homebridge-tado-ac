const TadoApi = require('./tado/api')
const syncHomeKitCache = require('./tado/syncHomeKitCache')
const refreshState = require('./tado/refreshState')
const path = require('path')
const storage = require('node-persist')
const PLUGIN_NAME = 'homebridge-tado-ac'
const PLATFORM_NAME = 'TadoAC'

module.exports = (api) => {
	api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, TadoACPlatform)
}

class TadoACPlatform {
	constructor(log, config, api) {

		this.cachedAccessories = []
		this.activeAccessories = []
		this.log = log
		this.api = api
		this.storage = storage
		this.refreshState = refreshState(this)
		this.syncHomeKitCache = syncHomeKitCache(this)
		this.name = PLATFORM_NAME
		this.disableFan = config['disableFan'] || false
		this.disableDry = config['disableDry'] || false
		this.enableHistoryStorage = config['historyStorage'] || false
		this.debug = config['debug'] || false
		this.PLUGIN_NAME = PLUGIN_NAME
		this.PLATFORM_NAME = PLATFORM_NAME

		// ~~~~~~~~~~~~~~~~~~~~~ Tado Specials ~~~~~~~~~~~~~~~~~~~~~ //
		
		this.username = config['username']
		this.password = config['password']
		
		if (!this.username || !this.password) {
			this.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX  --  ERROR  --  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\n')
			this.log('Can\'t start homebridge-tado-ac plugin without username and password !!\n')
			this.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\n')
			return
		}
		this.homeId = config['homeID'] || false
		this.tadoMode = config['tadoMode'] || 'MANUAL'
    this.durationInMinutes = config['durationInMinutes'] || 90
    this.weatherSensorsEnabled = config['weatherSensorsEnabled'] || false
		this.weatherPollingInterval = !isNaN(config['weatherPollingInterval']) ? (config['weatherPollingInterval'] * 60 * 1000) : 300000 // default is 5 minutes
		if (this.weatherPollingInterval < 30000) this.weatherPollingInterval = 60000 // minimum 1 minute to not overload
    this.occupancySensorsEnabled = config['occupancySensorsEnabled'] || false
		this.occupancyPollingInterval = !isNaN(config['occupancyPollingInterval']) ? (config['occupancyPollingInterval'] * 1000) : 10000 // default is 10 seconds
		if (this.occupancyPollingInterval < 3000) this.occupancyPollingInterval = 3000 // minimum 3 seconds to not overload
    this.anyoneSensor = config['anyoneSensor'] || false
		this.extraHumiditySensor = config['extraHumiditySensor'] || false

    this.manualControlSwitch = config['manualControl'] || config['manualControlSwitch'] || false
    this.extraHumiditySensor = config['extraHumiditySensor'] || false
    this.forceThermostat = config['forceThermostat'] || false
    this.forceHeaterCooler = config['forceHeaterCooler'] || false //new
    this.disableAcAccessory = config['disableAcAccessory'] || false //new


		this.persistPath = path.join(this.api.user.persistPath(), '/../tado-persist')
		this.emptyState = {devices:{}, weather:{} ,occupancy: {}}
		this.CELSIUS_UNIT = 'CELSIUS'
		this.FAHRENHEIT_UNIT = 'FAHRENHEIT'
		const requestedInterval = config['statePollingInterval'] || false
		this.refreshDelay = 2000
		
		// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

		this.setProcessing = false
		this.pollingTimeout = null
		this.processingState = false
		this.refreshTimeout = null
		this.pollingInterval = requestedInterval ? (requestedInterval * 1000 - this.refreshDelay) : false

		// define debug method to output debug logs when enabled in the config
		this.log.easyDebug = (...content) => {
			if (this.debug) {
				this.log(content.reduce((previous, current) => {
					return previous + ' ' + current
				}))
			} else
				this.log.debug(content.reduce((previous, current) => {
					return previous + ' ' + current
				}))
		}
		
		this.api.on('didFinishLaunching', async () => {

			await this.storage.init({
				dir: this.persistPath,
				forgiveParseErrors: true
			})


			this.cachedState = await this.storage.getItem('state') || this.emptyState
			
			try {
				this.tadoApi = await TadoApi(this)
			} catch(err) {
				this.log.easyDebug(err)
				return
			}

			try {
				this.devices = await this.tadoApi.getAllDevices()
				await this.storage.setItem('devices', this.devices)
			} catch(err) {
				this.devices = await this.storage.getItem('devices') || []
			}

			if (this.weatherSensorsEnabled) {
				try {
					this.weather = await this.tadoApi.getWeather()
					await this.storage.setItem('weather', this.weather)
					setInterval(this.refreshState.weather, this.weatherPollingInterval)
				} catch(err) {
					this.log('Can\'t get live Weather information -> Searching in storage...')
					this.weather = await this.storage.getItem('weather')
					if (this.weather) {
						this.log('Found weather information in storage - the plugin will keep scanning for weather changes.')
						setInterval(this.refreshState.weather, this.weatherPollingInterval)
					} else {
						this.log('Can\'t get Weather information -> The plugin will not create weather accessories')
					}
					
				}
			}

			if (this.occupancySensorsEnabled) {
				try {
					this.users = await this.tadoApi.getUsers()
					await this.storage.setItem('users', this.users)
					setInterval(this.refreshState.occupancy, this.occupancyPollingInterval)
				} catch(err) {
					this.log('Can\'t get live Users information -> Searching in storage...')
					this.users = await this.storage.getItem('users')
					if (this.users) {
						this.log('Found users in storage - the plugin will keep scanning for those users.')
						setInterval(this.refreshState.occupancy, this.occupancyPollingInterval)
					} else {
						this.log('Can\'t get Users information -> The plugin will not create occupancy accessories')
						this.users = []
					}
				}
			}

			if (this.pollingInterval)
				this.pollingTimeout = setTimeout(this.refreshState.ac, this.pollingInterval)
			
			
			this.syncHomeKitCache()

		})

	}

	configureAccessory(accessory) {
		this.cachedAccessories.push(accessory)
	}

}
