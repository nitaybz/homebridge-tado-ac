let Service, Characteristic, tadoHelpers
const async = require("async")
const tadoApi = require("./lib/tadoApi.js")
const storage = require('node-persist')


module.exports = function (homebridge) {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    Accessory = homebridge.hap.Accessory
    HomebridgeAPI = homebridge
    homebridge.registerPlatform('homebridge-tado-ac', 'TadoAC', TadoACplatform)

    tadoHelpers = require("./lib/tadoHelpers.js")(tadoApi, storage, Characteristic)
}

function TadoACplatform(log, config, api) {
    this.log = log
    this.config = config
    this.name = config['name'] || "Tado AC"
    this.username = config['username']
    this.password = encodeURIComponent(config['password'])
    this.homeId = config['homeID']
    this.tadoMode = config['tadoMode'] || "MANUAL"
    this.durationInMinutes = config['durationInMinutes'] || 90
    this.weatherSensorsEnabled = config['weatherSensorsEnabled'] || false
    this.weatherPollingInterval = (config['weatherPollingInterval'] * 60 * 1000) || false
    this.occupancySensorsEnabled = config['occupancySensorsEnabled'] || false
    this.occupancyPollingInterval = (config['occupancyPollingInterval'] * 1000) || 10000
    this.anyoneSensor = config['anyoneSensor'] === false ? false : true
    this.statePollingInterval = (config['statePollingInterval'] * 1000) || false //new
    this.debug = config['debug']
    // special settings for zones
    this.manualControlSwitch = config['manualControl'] || config['manualControlSwitch'] || false
    this.disableHumiditySensor = config['disableHumiditySensor'] || false
    this.extraHumiditySensor = config['extraHumiditySensor'] || false
    this.autoFanOnly = config['autoOnly'] || config['autoFanOnly'] || false
    this.disableFan = config['disableFan'] || false
    this.forceThermostat = config['forceThermostat'] || false //new

    storage.initSync({
        dir: HomebridgeAPI.user.persistPath()
    })

    tadoHelpers.storeToken = tadoHelpers.storeToken.bind(this)
    tadoApi.getToken = tadoApi.getToken.bind(this)

    //Get Token
    if (this.debug) this.log('Getting Token')

    tadoApi.getToken(this.username, this.password, tadoHelpers.storeToken)
    setInterval(() => {
        if (this.debug) this.log('Getting Token')
        tadoApi.getToken(this.username, this.password, tadoHelpers.storeToken)
    }, 500000)
}

TadoACplatform.prototype = {
    accessories: function (callback) {
        myAccessories = []

        async.waterfall([

            // Get homeId
            (next) => {
                const localHomeId = storage.getItem("TadoHomeId")
                if (!this.homeId) {
                    if (localHomeId) {

                        this.homeId = localHomeId
                        if (this.debug) this.log("Home ID found in storage", this.homeId)
                        next()
                    } else {
                        if (this.debug) this.log("Getting Home ID")
                        tadoApi.getHomeId(this.username, this.password, (err, homeId) => {
                            if (err) {
                                this.log('XXX - Error Getting Home ID - XXX')
                                next(err)
                            } else {
                                this.homeId = homeId
                                if (this.debug) this.log('Got Home ID:', homeId)
                                storage.setItem("TadoHomeId", homeId)
                                next()
                            }
                        })
                    }
                } else {
                    if (this.homeId || localHomeId) {
                        if (this.debug) this.log('Home ID exists:', this.homeId || localHomeId)
                        storage.setItem("TadoHomeId", this.homeId)
                        next()
                    }
                }
            },

            // Get Temperature Unit
            (next) => {
                if (this.debug) this.log('Getting Temperature Unit...')
                tadoApi.getTemperatureUnit(this.username, this.password, this.homeId, (err, temperatureUnit) => {
                    if (err) {
                        this.log('XXX - Error Getting Temperature Unit - XXX')
                        next(err)
                    } else {
                        this.temperatureUnit = temperatureUnit
                        if (this.debug) this.log('Got temperature unit:', this.temperatureUnit)
                        next()
                    }
                })
            },

            // Get Zones
            (next) => {
                if (this.debug) this.log('Getting Zones...')
                tadoApi.getZones(this.username, this.password, this.homeId, (err, zones) => {
                    if (err) {
                        this.log('XXX - Error Getting Zones - XXX')
                        next(err)
                    } else {
                        zones = zones.filter(zone => zone.type === "AIR_CONDITIONING")
                            .map(zone => {
                                this.log("Found new Zone: " + zone.name + " (" + zone.id + ") ...")
                                if (this.autoFanOnly) zoneAutoFan = (this.autoFanOnly === true || this.autoFanOnly.includes(zone.name) || this.autoFanOnly.includes(zone.id))
                                else zoneAutoFan = false
                                if (this.manualControlSwitch) zoneManualControl = (this.manualControlSwitch === true || this.manualControlSwitch.includes(zone.name) || this.manualControlSwitch.includes(zone.id))
                                else zoneManualControl = false
                                if (this.disableHumiditySensor) zoneDisableHumiditySensor = (this.disableHumiditySensor === true || this.disableHumiditySensor.includes(zone.name) || this.disableHumiditySensor.includes(zone.id))
                                else zoneDisableHumiditySensor = false
                                if (this.extraHumiditySensor) zoneExtraHumiditySensor = (this.extraHumiditySensor === true || this.extraHumiditySensor.includes(zone.name) || this.extraHumiditySensor.includes(zone.id))
                                else zoneExtraHumiditySensor = false
                                if (this.disableFan) zoneDisableFan = (this.disableFan === true || this.disableFan.includes(zone.name) || this.disableFan.includes(zone.id))
                                else zoneDisableFan = false
                                if (this.forceThermostat) zoneForceThermostat = (this.forceThermostat === true || this.forceThermostat.includes(zone.name) || this.forceThermostat.includes(zone.id))
                                else zoneForceThermostat = false

                                return {
                                    id: zone.id,
                                    name: zone.name,
                                    homeId: this.homeId,
                                    username: this.username,
                                    password: this.password,
                                    temperatureUnit: this.temperatureUnit,
                                    tadoMode: this.tadoMode,
                                    durationInMinutes: this.durationInMinutes,
                                    statePollingInterval: this.statePollingInterval,
                                    autoFanOnly: zoneAutoFan,
                                    manualControl: zoneManualControl,
                                    disableHumiditySensor: zoneDisableHumiditySensor,
                                    extraHumiditySensor: zoneExtraHumiditySensor,
                                    disableFan: zoneDisableFan,
                                    forceThermostat: zoneForceThermostat,
                                    debug: this.debug
                                }
                            })
                        if (this.debug) this.log('Zones:', JSON.stringify(zones, null, 4))
                        next(null, zones)
                    }
                })
            },

            //get Setup Method (NON-THERMOSTATIC / THERMOSTATIC)
            (zones, next) => {
                if (this.debug) this.log('Getting Installations...')
                tadoApi.getInstallations(this.username, this.password, this.homeId, (err, installations) => {
                    if (err) {
                        this.log('XXX - Error Getting Zones Installation - XXX')
                        next(err)
                    } else {
                        if (this.debug) this.log('Got Installations:', JSON.stringify(installations, null, 4))
                        zones = zones.map(zone => {
                            const thatZone = installations.find(device => {
                                if (device.acInstallationInformation)
                                    return device.acInstallationInformation.createdZone.id == zone.id
                                else
                                    return false
                            })
                            if (thatZone) {
                                zone.serialNo = thatZone.devices[0].shortSerialNo
                                zone.isThermostatic = (thatZone.acInstallationInformation.selectedSetupBranch === "THERMOSTATIC")
                            } else {
                                if (this.debug) this.log('Can\'t find installation for', zone.name, '- Returning random serialNo and NON-THERMOSTATIC mode')
                                zone.serialNo = "WR1234567890"
                                zone.isThermostatic = false
                            }
                            return zone
                        })
                        next(null, zones)
                    }
                })
            },

            //get Capabilities
            (zones, next) => {
                if (this.debug) this.log('Getting Zones Capabilities')
                async.forEach(zones, (zone, nextZone) => {
                    tadoApi.getZoneCapabilities(this.username, this.password, this.homeId, zone.id, (err, capabilities) => {
                        if (err) {
                            this.log('XXX - Error Getting Zone ' + zone.id + ' Capabilities - XXX')
                            nextZone(err)
                        } else {
                            zone.capabilities = capabilities
                            if (this.debug) this.log('Adding Zone:')
                            if (this.debug) this.log(JSON.stringify(zone, null, 4))
                            tadoAccessory = new TadoAccessory(this.log, zone)
                            myAccessories.push(tadoAccessory)
                            nextZone()
                        }
                    })
                }, function (err) {
                    if (err) next(err)
                    else next()
                })
            },

            // set Outside Temperature Sensor
            (next) => {
                if (this.weatherSensorsEnabled) {
                    const weatherConfig = {
                        homeId: this.homeId,
                        username: this.username,
                        password: this.password,
                        temperatureUnit: this.temperatureUnit,
                        polling: this.weatherPollingInterval,
                        debug: this.debug
                    }

                    if (this.debug) this.log('Adding Weather Sensors:')
                    if (this.debug) this.log(JSON.stringify(weatherConfig, null, 4))
                    TadoWeatherAccessory = new TadoWeather(this.log, weatherConfig)
                    myAccessories.push(TadoWeatherAccessory)
                }
                next()
            },

            // Set Occupancy Sensors
            (next) => {
                if (this.occupancySensorsEnabled) {

                    this.occupancySensors = []

                    const addUser = (user) => {
                        const activeDevice = user.mobileDevices.find(device => {
                            return (device.settings.geoTrackingEnabled)
                        })

                        const occupancyConfig = {
                            homeId: this.homeId,
                            username: this.username,
                            password: this.password,
                            deviceId: activeDevice.id,
                            name: user.name,
                            device: activeDevice.deviceMetadata,
                            polling: this.occupancyPollingInterval,
                            debug: this.debug
                        }

                        if (this.debug) this.log('Adding Occupancy Sensor:')
                        if (this.debug) this.log(JSON.stringify(occupancyConfig, null, 4))

                        TadoOccupancySensor = new occupancySensor(this.log, occupancyConfig, this)
                        myAccessories.push(TadoOccupancySensor)
                        this.occupancySensors.push(TadoOccupancySensor)
                    }



                    tadoApi.getTrackedUsers(this.username, this.password, this.homeId, (err, trackedUsers) => {
                        if (err) {
                            this.log('XXX - Error Getting Connected Users - XXX')
                            next(err)
                        }
                        else {
                            trackedUsers.forEach(addUser)

                            if (this.occupancySensors.length > 0 && this.anyoneSensor) {
                                const anyoneUser = {
                                    homeId: this.homeId,
                                    username: this.username,
                                    password: this.password,
                                    deviceId: 11111,
                                    name: "Anyone",
                                    device: { platform: "anyone", osVersion: "1.1.1", model: "Tado" },
                                    polling: this.occupancyPollingInterval
                                }
                                if (this.debug) this.log('Adding Occupancy Sensor (Anyone):')
                                if (this.debug) this.log(JSON.stringify(anyoneUser, null, 4))

                                TadoAnyoneSensor = new occupancySensor(this.log, anyoneUser, this)
                                myAccessories.push(TadoAnyoneSensor)
                            }
                            next()
                        }
                    })

                } else next()
            }

        ], (err, result) => {
            if (err) {
                this.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
                this.log('Can\'t finish Tado Installation')
                this.log('Please check you config and restart homebridge')
                this.log('If the problem persist, plese open Issue at https://github.com/nitaybz/homebridge-tado-ac/issues')
                this.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
            } else {
                if (this.debug) this.log('Pushing Accessories:')
                if (this.debug) this.log(myAccessories)

                callback(myAccessories)
            }
        })
    }
}













/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************      TADO AC      ******************************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/





function TadoAccessory(log, config) {
    this.log = log
    this.zoneName = config.name
    this.name = config.name + " Tado"
    this.homeId = config.homeId
    this.username = config.username
    this.password = config.password
    this.tadoMode = config.tadoMode
    this.serialNo = config.serialNo
    this.isThermostatic = config.isThermostatic
    this.durationInMinutes = config.durationInMinutes
    this.zone = config.id
    this.useFahrenheit = config.temperatureUnit == "CELSIUS" ? false : true
    this.capabilities = config.capabilities
    this.statePollingInterval = config.statePollingInterval
    this.disableHumiditySensor = config.disableHumiditySensor
    this.extraHumiditySensor = config.extraHumiditySensor
    this.disableFan = config.disableFan
    this.autoFanOnly = config.autoFanOnly
    this.manualControlSwitch = config.manualControl
    this.forceThermostat = config.forceThermostat
    this.debug = config.debug

    this.lastOverlay = storage.getItem(this.name)
    this.lastState = {
        setting: { type: 'AIR_CONDITIONING', power: 'OFF' },
        overlay: {
            type: 'MANUAL',
            setting: {
                type: 'AIR_CONDITIONING', power: 'OFF'
            },
        },
        sensorDataPoints: {
            insideTemperature: {
                celsius: 20.81,
                fahrenheit: 69.46,
            },
            humidity: {
                percentage: 71.2,
            }
        }
    }

    this.getCurrentStateResponse = tadoHelpers.getCurrentStateResponse.bind(this)
    this.updateAccessoryState = tadoHelpers.updateAccessoryState.bind(this)
    this.setNewState = tadoHelpers.setNewState.bind(this)

    this.lastOverlay = tadoHelpers.buildOverlay(this.capabilities, this.tadoMode, this.autoFanOnly, this.durationInMinutes, this.lastOverlay)
    if (this.debug) this.log('Storing Overlay for', this.zoneName, ':')
    if (this.debug) this.log(JSON.stringify(this.lastOverlay, null, 4))
    storage.setItem(this.name, this.lastOverlay)

    if (this.statePollingInterval) {
        if (this.debug) this.log('Starting Get State Interval for', this.zoneName, ':', this.statePollingInterval)
        setInterval(() => {
            this.getCurrentStateResponse((state) => {
                this.updateAccessoryState(state, this.lastState)
            }, true)
        }, this.statePollingInterval)
    }

    this.offOverlay = {
        "termination": {
            "type": this.tadoMode
        },
        "setting": {
            "power": "OFF",
            "type": "AIR_CONDITIONING"
        }
    }
    if (this.tadoMode == "TIMER") { this.offOverlay.termination.durationInSeconds = this.durationInMinutes * 60 }
}


TadoAccessory.prototype.getServices = function () {

    const informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
        .setCharacteristic(Characteristic.Model, 'Tado Smart AC Control')
        .setCharacteristic(Characteristic.SerialNumber, this.serialNo)

    const services = [informationService]

    if (this.forceThermostat || this.isThermostatic) {
        if (this.debug) this.log('Setting Thermostatic Service for', this.zoneName)

        this.thermostatService = new Service.Thermostat(this.zoneName + " AC")

        this.thermostatService.getCharacteristic(Characteristic.On)
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this))

        this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', this.getCurrentHeatingCoolingState.bind(this))

        const props = [Characteristic.TargetHeatingCoolingState.OFF]

        if (this.capabilities.COOL) props.push(Characteristic.TargetHeatingCoolingState.COOL)
        if (this.capabilities.HEAT) props.push(Characteristic.TargetHeatingCoolingState.HEAT)
        if (this.capabilities.AUTO) props.push(Characteristic.TargetHeatingCoolingState.AUTO)
        

        this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .setProps({validValues: props})
            .on('get', this.getTargetHeatingCoolingState.bind(this))
            .on('set', this.setTargetHeatingCoolingState.bind(this))
            

        this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.01
            })
            .on('get', this.getCurrentTemperature.bind(this))

        if (this.capabilities.HEAT) maxVal = this.capabilities.HEAT.temperatures.celsius.max
        else maxVal = this.capabilities.COOL.temperatures.celsius.max
        if (this.capabilities.COOL) minVal = this.capabilities.COOL.temperatures.celsius.min
        else minVal = this.capabilities.HEAT.temperatures.celsius.min

        this.thermostatService.getCharacteristic(Characteristic.TargetTemperature)
            .setProps({
                minValue: minVal,
                maxValue: maxVal,
                minStep: 1
            })
            .on('get', this.getTargetTemperature.bind(this))
            .on('set', this.setTargetTemperature.bind(this))

        this.thermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getTemperatureDisplayUnits.bind(this))


        if (!this.disableHumiditySensor) {
            this.thermostatService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: 1
                })
                .on('get', this.getCurrentRelativeHumidity.bind(this))
        }

        services.push(this.thermostatService)

    } else {
        if (this.debug) this.log('Setting HeaterCooler Service for', this.zoneName)
        this.HeaterCoolerService = new Service.HeaterCooler(this.zoneName + " AC")

        this.HeaterCoolerService.getCharacteristic(Characteristic.Active)
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this))

        this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
            .on('get', this.getCurrentHeaterCoolerState.bind(this))


        const props = []

        if (this.capabilities.COOL) props.push(Characteristic.TargetHeaterCoolerState.COOL)
        if (this.capabilities.HEAT) props.push(Characteristic.TargetHeaterCoolerState.HEAT)
        if (this.capabilities.AUTO) props.push(Characteristic.TargetHeaterCoolerState.AUTO)

        this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .setProps({validValues: props})
            .on('get', this.getTargetHeaterCoolerState.bind(this))
            .on('set', this.setTargetHeaterCoolerState.bind(this))

        this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100,
                minStep: 0.01
            })
            .on('get', this.getCurrentTemperature.bind(this))

        if (this.capabilities.COOL) {
            this.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .setProps({
                    minValue: this.capabilities.COOL.temperatures.celsius.min,
                    maxValue: this.capabilities.COOL.temperatures.celsius.max,
                    minStep: 1
                })
                .on('get', this.getCoolingThresholdTemperature.bind(this))
                .on('set', this.setTargetTemperature.bind(this))
        }

        if (this.capabilities.HEAT) {
            this.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .setProps({
                    minValue: this.capabilities.HEAT.temperatures.celsius.min,
                    maxValue: this.capabilities.HEAT.temperatures.celsius.max,
                    minStep: 1
                })
                .on('get', this.getHeatingThresholdTemperature.bind(this))
                .on('set', this.setTargetTemperature.bind(this))

        }

        this.HeaterCoolerService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', this.getTemperatureDisplayUnits.bind(this))

        if (this.capabilities.COOL.swings || this.capabilities.HEAT.swings) {
            this.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode)
                .on('get', this.getSwing.bind(this))
                .on('set', this.setSwing.bind(this))
        }

        if ((this.capabilities.COOL.fanSpeeds || this.capabilities.HEAT.fanSpeeds) && !this.autoFanOnly) {
            const getMaxSpeed = () => {
                if (this.capabilities.COOL.fanSpeeds)
                    max = this.capabilities.COOL.fanSpeeds.filter(speed => speed !== 'AUTO').length
                if (this.capabilities.HEAT.fanSpeeds)
                    max = this.capabilities.HEAT.fanSpeeds.filter(speed => speed !== 'AUTO').length <= max ?
                        max : this.capabilities.HEAT.fanSpeeds.filter(speed => speed !== 'AUTO').length > max

                return max
            }

            this.fanspeedSteps = parseFloat((100 / getMaxSpeed()).toFixed(2))

            this.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: this.fanspeedSteps
                })
                .on('get', this.getRotationSpeed.bind(this))
                .on('set', this.setRotationSpeed.bind(this))
        }


        if (!this.disableHumiditySensor) {
            if (this.debug) this.log('Setting Humidity Sensor for', this.zoneName)

            this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: 1
                })
                .on('get', this.getCurrentRelativeHumidity.bind(this))
        }

        services.push(this.HeaterCoolerService)


    }


    if (this.extraHumiditySensor) {
        if (this.debug) this.log('Setting Humidity Sensor for', this.zoneName)

        this.HumiditySensorService = new Service.HumiditySensor(this.zoneName + " Humidity");
        this.HumiditySensorService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: 1
            })
            .on('get', this.getCurrentRelativeHumidity.bind(this))

        services.push(this.HumiditySensorService)
    }


    if (this.capabilities.FAN && !this.disableFan) {
        if (this.debug) this.log('Setting Fanv2 Service for', this.zoneName)
        this.FanService = new Service.Fanv2(this.zoneName + " Fan")

        this.FanService.getCharacteristic(Characteristic.Active)
            .on('get', this.getFanActive.bind(this))
            .on('set', this.setFanActive.bind(this))

        if (this.capabilities.FAN.swings) {
            this.FanService.getCharacteristic(Characteristic.SwingMode)
                .on('get', this.getFanSwing.bind(this))
                .on('set', this.setFanSwing.bind(this))
        }


        if (this.capabilities.FAN.fanSpeeds && !this.autoFanOnly) {
            const max = this.capabilities.FAN.fanSpeeds.filter(speed => speed !== 'AUTO').length
            this.fanFanspeedSteps = parseFloat((100 / max).toFixed(2))

            this.FanService.getCharacteristic(Characteristic.RotationSpeed)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: this.fanFanspeedSteps
                })
                .on('get', this.getFanRotationSpeed.bind(this))
                .on('set', this.setFanRotationSpeed.bind(this))
        }

        services.push(this.FanService)
    }

    if (this.manualControlSwitch) {
        if (this.debug) this.log('Setting Manual Control Switch for', this.zoneName)
        this.ManualSwitchService = new Service.Switch(this.zoneName + " Manual")

        this.ManualSwitchService.getCharacteristic(Characteristic.On)
            .on('get', this.getManualSwitch.bind(this))
            .on('set', this.setManualSwitch.bind(this))

        services.push(this.ManualSwitchService)
    }

    return services
}



/*********************************************************************************/
/***********************************  GET COMMANDS  ******************************/
/*********************************************************************************/

// For HeaterCooler + Thermostat
TadoAccessory.prototype.getActive = function (callback) {
    if (this.debug) this.log('Getting Active State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        if (state.setting.power == "OFF" || state.setting.mode == "FAN" || state.setting.mode == "DRY") {
            if (this.debug) this.log(this.zoneName, 'Active State is 0')
            callback(null, 0)
        } else {
            if (this.debug) this.log(this.zoneName, 'Active State is 1')
            callback(null, 1)
        }
    })
}


// For Thermostat
TadoAccessory.prototype.getCurrentHeatingCoolingState = function (callback) {
    if (this.debug) this.log('Getting Current Thermostat State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        this.log(this.zoneName + " Current Mode is ", state.setting.mode || state.setting.power)
        if (state.setting.power == "OFF" || state.setting.mode == "FAN" || state.setting.mode == "DRY")
            callback(null, Characteristic.CurrentHeatingCoolingState.OFF)
        else if (state.setting.mode == "COOL")
            callback(null, Characteristic.CurrentHeatingCoolingState.COOL)
        else if (state.setting.mode == "HEAT")
            callback(null, Characteristic.CurrentHeatingCoolingState.HEAT)
        else if (state.setting.mode == "AUTO") {
            // trying to guess if the AC is Cooling or Heating since tado doesn't have temperature setting in AUTO mode
            const insideTemperature = state.sensorDataPoints.insideTemperature.celsius
            if (insideTemperature > 22)
                callback(null, Characteristic.CurrentHeatingCoolingState.COOL)
            else
                callback(null, Characteristic.CurrentHeatingCoolingState.HEAT)
        }
    })
}

// For Thermostat
TadoAccessory.prototype.getTargetHeatingCoolingState = function (callback) {
    if (this.debug) this.log('Getting Target Thermostat State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        if (this.debug) this.log(this.zoneName + " Target Mode is ", state.setting.mode || state.setting.power)
        if (state.setting.power == "OFF" || state.setting.mode == "FAN" || state.setting.mode == "DRY")
            callback(null, Characteristic.TargetHeatingCoolingState.OFF)
        else if (state.setting.mode == "COOL")
            callback(null, Characteristic.TargetHeatingCoolingState.COOL)
        else if (state.setting.mode == "HEAT")
            callback(null, Characteristic.TargetHeatingCoolingState.HEAT)
        else if (state.setting.mode == "AUTO")
            callback(null, Characteristic.TargetHeatingCoolingState.AUTO)
    })
}

// For Thermostat
TadoAccessory.prototype.getTargetTemperature = function (callback) {
    if (this.debug) this.log('Getting Target Temperature State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        if (state.setting.power == "ON" && state.setting.mode !== "AUTO") {
            if (this.useFahrenheit)
                this.log(this.zoneName + " Target Temperature is " + state.setting.temperature.fahrenheit + "ºF")
            else
                this.log(this.zoneName + " Target Temperature is " + state.setting.temperature.celsius + "ºC")
            callback(null, state.setting.temperature.celsius)
        } else if (state.setting.power == "ON" && state.setting.mode == "AUTO") {
            if (this.debug) this.log(this.zoneName + " - AUTO Mode - returning 25 ºC Target Temperature")
            // returning 25 celsius degrees on auto mode since there is no temperture in Tado for AUTO mode
            callback(null, 25)
        } else {
            if (this.debug) this.log(this.zoneName + " is OFF - returning null Target Temperature")
            callback(null, null)
        }
    })
}

// For HeaterCooler
TadoAccessory.prototype.getCurrentHeaterCoolerState = function (callback) {
    if (this.debug) this.log('Getting Current HeaterCooler State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        this.log(this.zoneName + " Mode is ", state.setting.mode || state.setting.power)
        if (state.setting.power == "OFF" || state.setting.mode == "FAN" || state.setting.mode == "DRY")
            callback(null, Characteristic.CurrentHeaterCoolerState.INACTIVE)
        else if (state.setting.mode == "COOL")
            callback(null, Characteristic.CurrentHeaterCoolerState.COOLING)
        else if (state.setting.mode == "HEAT")
            callback(null, Characteristic.CurrentHeaterCoolerState.HEATING)
        else if (state.setting.mode == "AUTO") {
            // trying to guess if the AC is Cooling or Heating since tado doesn't have temperature setting in AUTO mode
            const insideTemperature = state.sensorDataPoints.insideTemperature.celsius
            if (insideTemperature > 22) {
                callback(null, Characteristic.CurrentHeaterCoolerState.COOLING)
            } else {
                callback(null, Characteristic.CurrentHeaterCoolerState.HEATING)
            }
        }
    })
}

// For HeaterCooler
TadoAccessory.prototype.getTargetHeaterCoolerState = function (callback) {
    if (this.debug) this.log('Getting Target HeaterCooler State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        if (this.debug) this.log(this.zoneName + " Target State is ", state.setting.mode || state.setting.power)
        if (state.setting.power == "OFF" || state.setting.mode == "FAN" || state.setting.mode == "DRY")
            callback()
        else if (state.setting.mode == "COOL")
            callback(null, Characteristic.TargetHeaterCoolerState.COOL)
        else if (state.setting.mode == "HEAT")
            callback(null, Characteristic.TargetHeaterCoolerState.HEAT)
        else if (state.setting.mode == "AUTO")
            callback(null, Characteristic.TargetHeaterCoolerState.AUTO)
        else
            callback()
    })
}

// For HeaterCooler + Thermostat
TadoAccessory.prototype.getCurrentTemperature = function (callback) {
    if (this.debug) this.log('Getting Room Temperature', this.zoneName)

    this.getCurrentStateResponse((state) => {
        if (this.useFahrenheit)
            this.log(this.zoneName + " Current Temperature is " + state.sensorDataPoints.insideTemperature.fahrenheit + "ºF")
        else
            this.log(this.zoneName + " Current Temperature is " + state.sensorDataPoints.insideTemperature.celsius + "ºC")

        callback(null, state.sensorDataPoints.insideTemperature.celsius)
    })
}

// For HeaterCooler
TadoAccessory.prototype.getCoolingThresholdTemperature = function (callback) {
    if (this.debug) this.log('Getting Cooling Threshold Temperature', this.zoneName)

    this.getCurrentStateResponse((state) => {
        if (state.setting.power == "ON" && state.setting.mode == "COOL") {
            if (this.useFahrenheit)
                this.log(this.zoneName + " Target Temperature is " + state.setting.temperature.fahrenheit + "ºF")
            else
                this.log(this.zoneName + " Target Temperature is " + state.setting.temperature.celsius + "ºC")
            callback(null, state.setting.temperature.celsius)
        } else if (state.setting.power == "ON" && state.setting.mode == "AUTO")
            // returning 25 celsius degrees on auto mode since there is no temperture in Tado for AUTO mode
            callback(null, 25)
        else
            callback(null, null)
    })
}

// For HeaterCooler
TadoAccessory.prototype.getHeatingThresholdTemperature = function (callback) {
    if (this.debug) this.log('Getting Heating Threshold Temperature', this.zoneName)

    this.getCurrentStateResponse((state) => {
        if (state.setting.power == "ON" && state.setting.mode == "HEAT") {
            if (this.useFahrenheit)
                this.log(this.zoneName + " Target Temperature is " + state.setting.temperature.fahrenheit + "ºF")
            else
                this.log(this.zoneName + " Target Temperature is " + state.setting.temperature.celsius + "ºC")
            callback(null, state.setting.temperature.celsius)
        } else if (state.setting.power == "ON" && state.setting.mode == "AUTO")
            // returning 25 celsius degrees on auto mode since there is no temperture in Tado for AUTO mode
            callback(null, 25)
        else
            callback(null, null)
    })
}

// For HeaterCooler + Thermostat
TadoAccessory.prototype.getTemperatureDisplayUnits = function (callback) {
    if (this.debug) {
        this.log('Getting Temperature Display Units', this.zoneName)
        this.log("The current temperature display unit is " + (this.useFahrenheit ? "ºF" : "ºC"))
    }

    callback(null, this.useFahrenheit ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS)
}

// For HeaterCooler
TadoAccessory.prototype.getSwing = function (callback) {
    if (this.debug) this.log('Getting Swing State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        if (state.setting.power == "ON" && this.capabilities[state.setting.mode].swings) {
            if (this.debug) this.log(this.zoneName + " Swing is " + state.setting.swing)
            callback(null, state.setting.swing == "ON" ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED)
        } else {
            if (this.debug) this.log(this.zoneName + " Swing - Device is OFF")
            callback(null, null)
        }
    })

}

// For HeaterCooler
TadoAccessory.prototype.getRotationSpeed = function (callback) {
    if (this.debug) this.log('Getting Rotation Speed', this.zoneName)
    this.getCurrentStateResponse((state) => {
        if (state.setting.power == "ON" && this.capabilities[state.setting.mode].fanSpeeds) {
            if (this.debug) this.log(this.zoneName + " Rotation Speed is", state.setting.fanSpeed, tadoHelpers.returnFanspeedValue(state.setting.fanSpeed, this.fanspeedSteps))
            callback(null, tadoHelpers.returnFanspeedValue(state.setting.fanSpeed, this.fanspeedSteps))
        } else {
            if (this.debug) this.log(this.zoneName + " Rotation Speed - Device is OFF")
            callback(null, null)
        }
    })
}

// For HeaterCooler + Thermostat
TadoAccessory.prototype.getCurrentRelativeHumidity = function (callback) {
    if (this.debug) this.log('Getting Current Relative Humidity', this.zoneName)
    this.getCurrentStateResponse((state) => {
        this.log(this.zoneName + " Humidity is " + state.sensorDataPoints.humidity.percentage + "%")
        callback(null, state.sensorDataPoints.humidity.percentage)
    })
}

// For Fan
TadoAccessory.prototype.getFanActive = function (callback) {
    if (this.debug) this.log('Getting Fan Active State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        if (state.setting.power !== "OFF" && state.setting.mode == "FAN") {
            if (this.debug) this.log(this.zoneName, 'Fan Active State is 1')
            callback(null, Characteristic.Active.ACTIVE)
        } else {
            if (this.debug) this.log(this.zoneName, 'Fan Active State is 0')
            callback(null, Characteristic.Active.INACTIVE)
        }
    })
}

// For Fan
TadoAccessory.prototype.getFanSwing = function (callback) {
    if (this.debug) this.log('Getting Fan Swing State', this.zoneName)
    this.getCurrentStateResponse((state) => {
        if (state.setting.power == "ON" && state.setting.mode == "FAN" && this.capabilities["FAN"].swings) {
            if (this.debug) this.log(this.zoneName + " Swing is " + state.setting.swing)
            callback(null, state.setting.swing == "ON" ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED)
        } else {
            if (this.debug) this.log(this.zoneName + " FanSwing - Device is OFF")
            callback(null, null)
        }
    })
}

// For Fan
TadoAccessory.prototype.getFanRotationSpeed = function (callback) {
    if (this.debug) this.log('Getting Fan Rotation Speed', this.zoneName)

    this.getCurrentStateResponse((state) => {
        if (state.setting.power == "ON" && state.setting.mode == "FAN" && this.capabilities["FAN"].fanSpeeds) {
            if (this.debug) this.log(this.zoneName + " Fan Rotation Speed is", state.setting.fanSpeed, tadoHelpers.returnFanFanspeedValue(state.setting.fanSpeed, this.fanFanspeedSteps))
            callback(null, tadoHelpers.returnFanspeedValue(state.setting.fanSpeed, this.fanFanspeedSteps))
        } else {
            if (this.debug) this.log(this.zoneName + " Fan Rotation Speed - Device is OFF")
            callback(null, null)
        }
    })
}


// For Manual Control Switch
TadoAccessory.prototype.getManualSwitch = function (callback) {

    this.getCurrentStateResponse((state) => {
        if (!state.overlay) {
            this.log("Manual Control is OFF!")
            callback(null, false)
        } else {
            this.log("Manual Control is ON!")
            callback(null, true)
        }
    })
}


/*********************************************************************************/
/***********************************  SET COMMANDS  ******************************/
/*********************************************************************************/

// For HeaterCooler + Thermostat
TadoAccessory.prototype.setActive = function (state, callback) {
    state = state == 1 ? "ON" : "OFF"
    if (this.debug) this.log(this.zoneName + " -> Setting state Active:", 'power', state)
    this.setNewState('power', state)
    callback()
}

// For HeaterCooler
TadoAccessory.prototype.setTargetHeaterCoolerState = function (state, callback) {
    switch (state) {
        case Characteristic.TargetHeaterCoolerState.COOL:
            state = "COOL"
            break
        case Characteristic.TargetHeaterCoolerState.HEAT:
            state = "HEAT"
            break
        case Characteristic.TargetHeaterCoolerState.AUTO:
            state = "AUTO"
            break
    }
    if (this.debug) this.log(this.zoneName + " -> Setting Target HeaterCooler State:", 'mode', state)
    this.setNewState('mode', state)
    callback()
}

// For Thermostat
TadoAccessory.prototype.setTargetHeatingCoolingState = function (state, callback) {
    switch (state) {
        case Characteristic.TargetHeatingCoolingState.OFF:
            state = "OFF"
            break
        case Characteristic.TargetHeatingCoolingState.COOL:
            state = "COOL"
            break
        case Characteristic.TargetHeatingCoolingState.HEAT:
            state = "HEAT"
            break
        case Characteristic.TargetHeatingCoolingState.AUTO:
            state = "AUTO"
            break
    }
    if (this.debug) this.log(this.zoneName + " -> Setting Target Thermostat State:", 'mode', state)
    this.setNewState('mode', state)
    callback()
}

// For HeaterCooler + Thermostat
TadoAccessory.prototype.setTargetTemperature = function (temp, callback) {
    if (this.debug) this.log(this.zoneName + " -> Setting Target Temperature:", 'temp', temp)
    this.setNewState('temp', temp)
    callback()
}

TadoAccessory.prototype.setSwing = function (state, callback) {
    if (this.debug) this.log(this.zoneName + " -> Setting Swing:", 'swing', state)
    state = state === Characteristic.SwingMode.SWING_ENABLED ? "ON" : "OFF"
    this.setNewState('swing', state)
    callback()
}

TadoAccessory.prototype.setRotationSpeed = function (speed, callback) {
    if (this.autoFanOnly)
        speed = "AUTO"
    else
        switch (Math.round(speed)) {
            case 100:
                speed = "HIGH"
                break
            case Math.round(this.fanspeedSteps * 2):
                speed = "MIDDLE"
                break
            case Math.round(this.fanspeedSteps):
                speed = "LOW"
                break
        }
    if (this.debug) this.log(this.zoneName + " -> Setting Rotation Speed:", 'fanspeed', speed)
    this.setNewState('fanspeed', speed)
    callback()
}

TadoAccessory.prototype.setFanActive = function (state, callback) {
    state = state === Characteristic.Active.ACTIVE ? "ON" : "OFF"
    if (this.debug) this.log(this.zoneName + " -> Setting Fan Active State:", 'fanPower', state)
    this.setNewState('fanPower', state)
    callback()
}

TadoAccessory.prototype.setFanSwing = function (state, callback) {
    state = state === Characteristic.SwingMode.SWING_ENABLED ? "ON" : "OFF"
    if (this.debug) this.log(this.zoneName + " -> Fan Setting Swing:", 'fanSwing', state)
    this.setNewState('fanSwing', state)
    callback()
}

TadoAccessory.prototype.setFanRotationSpeed = function (speed, callback) {
    if (this.autoFanOnly)
        speed = "AUTO"
    else
        switch (Math.round(speed)) {
            case 100:
                speed = "HIGH"
                break
            case Math.round(this.fanspeedSteps * 2):
                speed = "MIDDLE"
                break
            case Math.round(this.fanspeedSteps):
                speed = "LOW"
                break
        }
    if (this.debug) this.log(this.zoneName + " -> Setting Fan Rotation Speed:", 'fanFanspeed', speed)
    this.setNewState('fanFanspeed', speed)
    callback()
}


TadoAccessory.prototype.setManualSwitch = function (state, callback) {
    if (this.debug) this.log(this.zoneName + " -> Setting Manual Control switch:", 'manualControl', state ? "ON" : "OFF")
    this.setNewState('manualControl', state ? "ON" : "OFF")
    callback()
}


















/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************    TADO Weather   ******************************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/

function TadoWeather(log, config) {
    this.log = log
    this.name = "Outside Temperature"
    this.homeId = config.homeId
    this.username = config.username
    this.password = config.password
    this.useFahrenheit = config.temperatureUnit == "CELSIUS" ? false : true
    this.polling = config.polling
    this.getWeatherState = tadoHelpers.getWeatherState.bind(this)
    this.debug = config.debug
    this.lastState = {
        solar: 0,
        temp: 0
    }

    this.informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
        .setCharacteristic(Characteristic.Model, 'Tado Weather')
        .setCharacteristic(Characteristic.SerialNumber, 'Tado Serial Weather')

    this.TemperatureSensor = new Service.TemperatureSensor(this.name)

    this.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
            maxValue: 100,
            minValue: -100,
            minStep: 1
        })
        .on('get', this.getOutsideTemperature.bind(this))

    this.SolarSensor = new Service.Lightbulb("Solar Intensity")

    this.SolarSensor.getCharacteristic(Characteristic.On)
        .on('get', this.getOn.bind(this))
        .on('set', this.setOn.bind(this))

    this.SolarSensor.getCharacteristic(Characteristic.Brightness)
        .setProps({
            maxValue: 100,
            minValue: 0,
            minStep: 1
        })
        .on('get', this.getSolar.bind(this))
        .on('set', this.setSolar.bind(this))


    if (this.polling) {
        if (this.debug) this.log('Starting Get Weather State Interval for Tado Weather:', this.polling)
        this.getWeatherState((state) => { }, true)
        setInterval(() => {
            this.getWeatherState((state) => { }, true)
        }, this.polling)
    }
}

TadoWeather.prototype.getServices = function () {
    return [this.TemperatureSensor, this.informationService, this.SolarSensor]
}

TadoWeather.prototype.getOutsideTemperature = function (callback) {
    this.getWeatherState((state) => {
        callback(null, state.temp)
    })
}

TadoWeather.prototype.getSolar = function (callback) {
    this.getWeatherState((state) => {
        callback(null, state.solar)
    })
}

TadoWeather.prototype.getOn = function (callback) {
    this.getWeatherState((state) => {
        callback(null, !!state.solar)
    })
}


TadoWeather.prototype.setSolar = function (state, callback) {
    this.getWeatherState((state) => {
        this.SolarSensor.getCharacteristic(Characteristic.Brightness).updateValue(state.solar)
    })
    callback()
}

TadoWeather.prototype.setOn = function (state, callback) {
    this.getWeatherState((state) => {
        if (state.solar)
            this.SolarSensor.getCharacteristic(Characteristic.On).updateValue(true)
        else
            this.SolarSensor.getCharacteristic(Characteristic.On).updateValue(false)
    })
    callback()
}










/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************   TADO Occupancy  ******************************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/

function occupancySensor(log, config, platform) {
    this.log = log
    this.platform = platform
    this.name = config.name
    this.deviceId = config.deviceId
    this.homeId = config.homeId
    this.username = config.username
    this.password = config.password
    this.polling = config.polling
    this.device = config.device
    this.occupied = false
    this.debug = config.debug

    this.checkOccupancy = tadoHelpers.checkOccupancy.bind(this)

    this.options = {
        host: 'my.tado.com',
        path: '/api/v2/homes/' + this.homeId + '/mobileDevices?password=' + this.password + '&username=' + this.username,
        method: 'GET'
    }


    this.informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Tado Occupancy')
        .setCharacteristic(Characteristic.Model, this.device.model)
        .setCharacteristic(Characteristic.SerialNumber, this.device.platform + " " + this.device.osVersion)

    this.OccupancySensor = new Service.OccupancySensor(this.name)

    this.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected)
        .on('get', this.getStatus.bind(this))

    if (this.name == "Anyone") {
        setTimeout(() => {
            this.checkOccupancy()
            setInterval(this.checkOccupancy, this.polling)
        }, 300)

    } else {
        this.checkOccupancy()
        setInterval(this.checkOccupancy, this.polling)
    }

}

occupancySensor.prototype.getServices = function () {
    return [this.informationService, this.OccupancySensor]
}

occupancySensor.prototype.getStatus = function (callback) {
    if (this.name == "Anyone")
        if (this.occupied == 1)
            this.log("Someone is Home!")
        else
            this.log("No One is Home!")
    else
        if (this.occupied == 1)
            this.log(this.name + " is at Home!")
        else
            this.log(this.name + " is Out!")

    callback(null, this.occupied)
}
