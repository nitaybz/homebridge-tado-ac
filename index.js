const Service, Characteristic
const async = require("async")
const tadoApi = require("./lib/tadoApi.js")
const storage = require('node-persist')
const tadoHelpers = require("./lib/tadoHelpers.js")(tadoApi, storage, Characteristic)

module.exports = (homebridge) => {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    Accessory = homebridge.hap.Accessory
    HomebridgeAPI = homebridge
    homebridge.registerPlatform('homebridge-tado-ac', 'TadoAC', TadoACplatform)
}

const TadoACplatform = (log, config, api) => {
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
    this.anyoneSensor = !!config['anyoneSensor']
    this.statePollingInterval = (config['statePollingInterval'] * 1000) || false //new

    // special settings for zones
    this.manualControlSwitch = config['manualControl'] || config['manualControlSwitch'] || false
    this.disableHumiditySensor = config['disableHumiditySensor'] || false
    this.autoFanOnly = config['autoOnly'] || config['autoFanOnly'] || false
    this.disableFan = config['disableFan'] || false
    this.forceThermostat = config['forceThermostat'] || false //new
 
    storage.initSync({
        dir: HomebridgeAPI.user.persistPath()
    })



    //Get Token
    tadoApi.getToken(this.username, this.password, tadoHelpers.storeToken)
    setInterval(() => {
        tadoApi.getToken(this.username, this.password, tadoHelpers.storeToken)
    }, 500000)
}

TadoACplatform.prototype = {
    accessories: (callback) => {
        const self = this
        const myAccessories = []

        async.waterfall([

            // Get homeId
            (next) => {
                const localHomeId = storage.getItem("TadoHomeId")
                if (!self.homeId){
                    if (localHomeId){
                        self.log("Home ID found in storage")
                        self.homeId = localHomeId
                    } else {
                        self.log("Getting Home ID")
                        tadoApi.getHomeId(self.username, self.password, (err, homeId) => {
                            if (err) {
                                self.log('XXX - Error Getting HomeID - XXX')
                                next(err)
                            } else self.homeId = homeId   
                        })
                    }
                } else {
                    if (self.homeId || localHomeId)
                        storage.setItem("TadoHomeId", self.homeId)
                }
            },

            // Get Temperature Unit
            (next) => {
                tadoApi.getTemperatureUnit(self.username, self.password, self.homeId, (err, temperatureUnit) => {
                    if (err) {
                        self.log('XXX - Error Getting Temperature Unit - XXX')
                        next(err)
                    } else {
                        self.temperatureUnit = temperatureUnit
                        next()
                    }
                })
            },

            // Get Zones
            (next) => {
                tadoApi.getZones(self.username, self.password, self.homeId, (err, zones) => {
                    if (err) {
                        self.log('XXX - Error Getting Zones - XXX')
                        next(err)
                    } else {
                        zones = zones.filter(zone => zone.type === "AIR_CONDITIONING")
                            .map(zone => {
                                self.log("Found new Zone: " + zone.name + " (" + zone.id + ") ...")
                                if (autoFanOnly) const zoneAutoFan = (self.autoFanOnly === true || self.autoFanOnly.includes(zone.name) || self.autoFanOnly.includes(zone.id))
                                else const zoneAutoFan = false
                                if (manualControlSwitch) const zoneManualControl = (self.manualControlSwitch === true || self.manualControlSwitch.includes(zone.name) || self.manualControlSwitch.includes(zone.id))
                                else const zoneManualControl = false
                                if (disableHumiditySensor) const zoneDisableHumiditySensor = (self.disableHumiditySensor === true || self.disableHumiditySensor.includes(zone.name) || self.disableHumiditySensor.includes(zone.id))
                                else const zoneDisableHumiditySensor = false
                                if (disableFan) const zoneDisableFan = (self.disableFan === true || self.disableFan.includes(zone.name) || self.disableFan.includes(zone.id))
                                else const zoneDisableFan = false
                                if (forceThermostat) const zoneForceThermostat = (self.forceThermostat === true || self.forceThermostat.includes(zone.name) || self.forceThermostat.includes(zone.id))
                                else const zoneForceThermostat = false
                                
                                return {
                                    id: zone.id,
                                    name: zones.name,
                                    homeId: self.homeId,
                                    username: self.username,
                                    password: self.password,
                                    temperatureUnit: self.temperatureUnit,
                                    tadoMode: self.tadoMode,
                                    durationInMinutes: self.durationInMinutes,
                                    statePollingInterval: self.statePollingInterval,
                                    autoFanOnly: zoneAutoFan,
                                    manualControl: zoneManualControl,
                                    disableHumiditySensor: zoneDisableHumiditySensor,
                                    disableFan: zoneDisableFan,
                                    forceThermostat: zoneForceThermostat
                                }
                        })
                        next(null, zones)
                    }
                })
            },

            //get Setup Method (NON-THERMOSTATIC / THERMOSTATIC)
            (zones, next) => {
                tadoApi.getInstallations(self.username, self.password, self.homeId, (err, installations) => {
                    if (err) {
                        self.log('XXX - Error Getting Zones Installation - XXX')
                        next(err)
                    } else {
                        zones = zones.map(zone => {
                            const thatZone = installations.find(device =>  device.id == zone.id)
                            zone.serialNo = that.zone.devices[0].shortSerialNo
                            zone.isThermostatic  = (thatZone.acInstallationInformation.selectedSetupBranch === "THERMOSTATIC")
                            return zone
                        })
                        next(null, zones)
                    }
                })
            },

            //get Capabilities
            (zones, next) => {
                async.forEach(zones, (zone, nextZone) => {
                    tadoApi.getZoneCapabilities(self.username, self.password, self.homeId, zone.id, (err, capabilities) => {
                        if (err) {
                            self.log('XXX - Error Getting Zone ' + zone.id + ' Capabilities - XXX')
                            next(err)
                        } else {
                            zone.capabilities = capabilities
                            self.log('Adding zone:')
                            self.log(JSON.stringify(zone, null, 4))
                            const tadoAccessory = new TadoAccessory(self.log, zone)
                            myAccessories.push(tadoAccessory);
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
                if (self.weatherSensorsEnabled) {
                    const weatherConfig = {
                        homeId: self.homeId,
                        username: self.username,
                        password: self.password,
                        temperatureUnit: self.temperatureUnit,
                        polling: self.weatherPollingInterval
                    }
                    const TadoWeatherAccessory = new TadoWeather(self.log, weatherConfig)
                    myAccessories.push(TadoWeatherAccessory);
                }
                next();
            },

            // Set Occupancy Sensors
            (next) => {
                if (self.occupancySensorsEnabled) {

                    self.occupancySensors = [];

                    const addUser = (user) => {
                        const activeDevice = user.mobileDevices.find(device => {
                                return (device.settings.geoTrackingEnabled)
                        })

                        const occupancyConfig = {
                            homeId: self.homeId,
                            username: self.username,
                            password: self.password,
                            deviceId: activeDevice.id,
                            name: user.name,
                            device: activeDevice.deviceMetadata,
                            polling: self.occupancyPollingInterval
                        }

                        const TadoOccupancySensor = new occupancySensor(self.log, occupancyConfig, self)
                        myAccessories.push(TadoOccupancySensor);
                        self.occupancySensors.push(TadoOccupancySensor);
                    }



                    tadoApi.getTrackedUsers(self.username, self.password, self.homeId, (err, trackedUsers) => {
                        if (err) {
                            self.log('XXX - Error Getting Connected Users - XXX')
                            next(err)
                        }
                        else {
                            trackedUsers.forEach(addUser)
                            
                            if (self.occupancySensors.length > 0 && self.anyoneSensor) {
                                const anyoneUser = {
                                    homeId: self.homeId,
                                    username: self.username,
                                    password: self.password,
                                    deviceId: 11111,
                                    name: "Anyone",
                                    device: { platform: "anyone", osVersion: "1.1.1", model: "Tado" },
                                    polling: self.occupancyPollingInterval
                                }
                                const TadoAnyoneSensor = new occupancySensor(self.log, anyoneUser, self)
                                myAccessories.push(TadoAnyoneSensor);
                            }
                            next()
                        }
                    })

                } else next()
            }

        ], (err, result) => {
            if (err) {
                self.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
                self.log('Can\'t finish Tado Installation')
                self.log('Please check you config and restart homebridge')
                self.log('If the problem persist, plese open Issue at https://github.com/nitaybz/homebridge-tado-ac/issues')
                self.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
            } else callback(myAccessories)
        })
    }
}













    /********************************************************************************************************************************************************/
    /********************************************************************************************************************************************************/
    /*******************************************************************      TADO AC      ******************************************************************/
    /********************************************************************************************************************************************************/
    /********************************************************************************************************************************************************/





    const TadoAccessory = (log, config) => {
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
        this.disableFan = config.disableFan
        this.autoFanOnly = config.autoFanOnly
        this.manualControlSwitch = config.manualControl
        this.forceThermostat = config.forceThermostat

        this.lastOverlay = storage.getItem(this.name)
        this.lastState = null;

        if (!lastOverlay) {
            this.lastOverlay = tadoHelpers.buildFirstOverlay(this.capabilities, this.tadoMode, this.autoFanOnly, this.durationInMinutes)
            storage.setItem(this.name, this.lastOverlay);
        }


        if (this.statePollingInterval) {
            const self = this
            setInterval(() => {
                tadoHelpers.getCurrentStateResponse((state) => {
                    tadoHelpers.updateAccessoryState(state).bind(self)
                }, true).bind(this)
            }, this.statePollingInterval * 1000).bind(this)
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

    
    TadoAccessory.prototype.getServices = () => {

        const informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Tado Smart AC Control')
            .setCharacteristic(Characteristic.SerialNumber, this.serialNo);
        
        const services = [informationService]

        if (this.forceThermostat || this.isThermostatic) {
            this.thermostatService = new Service.Thermostat(this.zoneName + " AC");
                
            this.thermostatService.getCharacteristic(Characteristic.On)
            .on('get', this.getActive.bind(this))
            .on('set', this.setActive.bind(this));

            this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                .on('get', this.getCurrentHeatingCoolingState.bind(this))

            this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .on('get', this.getTargetHeatingCoolingState.bind(this))
                .on('set', this.setTargetHeatingCoolingState.bind(this))

            this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature)
                .setProps({
                    minValue: -100,
                    maxValue: 100,
                    minStep: 0.01
                })
                .on('get', this.getCurrentTemperature.bind(this))

            this.thermostatService.getCharacteristic(Characteristic.TargetTemperature)
                .setProps({
                    minValue: this.capabilities.COOL.temperatures.celsius.min,
                    maxValue: this.capabilities.HEAT.temperatures.celsius.max,
                    minStep: 1
                })
                .on('get', this.getTargetTemperature.bind(this))
                .on('set', this.setTargetTemperature.bind(this))

            this.thermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
                .on('get', this.getTemperatureDisplayUnits.bind(this));

            this.thermostatService.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: 1
                })
                .on('get', this.getCurrentRelativeHumidity.bind(this));


            services.push(this.thermostatService)

        } else {
            this.HeaterCoolerService = new Service.HeaterCooler(this.zoneName + " AC");
    
            this.HeaterCoolerService.getCharacteristic(Characteristic.Active)
                .on('get', this.getActive.bind(this))
                .on('set', this.setActive.bind(this));
    
            this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
                .on('get', this.getCurrentHeaterCoolerState.bind(this));
    
            this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState)
                .on('get', this.getTargetHeaterCoolerState.bind(this))
                .on('set', this.setTargetHeaterCoolerState.bind(this));
    
            this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentTemperature)
                .setProps({
                    minValue: -100,
                    maxValue: 100,
                    minStep: 0.01
                })
                .on('get', this.getCurrentTemperature.bind(this));
    
            this.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .setProps({
                    minValue: this.capabilities.COOL.temperatures.celsius.min,
                    maxValue: this.capabilities.COOL.temperatures.celsius.max,
                    minStep: 1
                })
                .on('get', this.getCoolingThresholdTemperature.bind(this))
                .on('set', this.setTargetTemperature.bind(this));
    
            this.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .setProps({
                    minValue: this.capabilities.HEAT.temperatures.celsius.min,
                    maxValue: this.capabilities.HEAT.temperatures.celsius.max,
                    minStep: 1
                })
                .on('get', this.getHeatingThresholdTemperature.bind(this))
                .on('set', this.setTargetTemperature.bind(this));
    
            this.HeaterCoolerService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
                .on('get', this.getTemperatureDisplayUnits.bind(this));
    
            if (this.capabilities.COOL.swings || this.capabilities.HEAT.swings) {
                this.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode)
                    .on('get', this.getSwing.bind(this))
                    .on('set', this.setSwing.bind(this));
            }
    
            if ((this.capabilities.COOL.fanSpeeds || this.capabilities.HEAT.fanSpeeds) && !this.autoFanOnly) {
                const getMaxSpeed = () => {
                    if (this.capabilities.COOL.fanSpeeds)
                        let max = this.capabilities.COOL.fanSpeeds.filter(speed => speed !== 'AUTO').length
                    if (this.capabilities.HEAT.fanSpeeds)
                        max = this.capabilities.HEAT.fanSpeeds.filter(speed => speed !== 'AUTO').length <= max ? 
                            max : this.capabilities.HEAT.fanSpeeds.filter(speed => speed !== 'AUTO').length > max;
                }
                
                this.fanspeedSteps = (100 / getMaxSpeed).toFixed(2)

                this.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed)
                    .setProps({
                        minValue: 0,
                        maxValue: 100,
                        minStep: this.fanspeedSteps
                    })
                    .on('get', this.getRotationSpeed.bind(this))
                    .on('set', this.setRotationSpeed.bind(this))
            }


            services.push(this.HeaterCoolerService);

            if (!this.disableHumiditySensor) {
                this.HumiditySensor = new Service.HumiditySensor(this.zoneName + " Humidity");
    
                this.HumiditySensor.getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .setProps({
                        minValue: 0,
                        maxValue: 100,
                        minStep: 1
                    })
                    .on('get', this.getCurrentRelativeHumidity.bind(this));
    
                services.push(this.HumiditySensor)
            }

        }

        if (this.capabilities.FAN && !this.disableFan) {
            this.FanService = new Service.Fanv2(this.zoneName + " Fan");

            this.FanService.getCharacteristic(Characteristic.Active)
                .on('get', this.getFanActive.bind(this))
                .on('set', this.setFanActive.bind(this));

            if (this.capabilities.FAN.swings) {
                this.FanService.getCharacteristic(Characteristic.SwingMode)
                    .on('get', this.getFanSwing.bind(this))
                    .on('set', this.setFanSwing.bind(this));
            }


            if (this.capabilities.FAN.fanSpeeds && !this.autoFanOnly) {
                const max = this.capabilities.FAN.fanSpeeds.filter(speed => speed !== 'AUTO').length
                this.fanFanspeedSteps = (100 / max).toFixed(2)

                this.FanService.getCharacteristic(Characteristic.RotationSpeed)
                    .setProps({
                        minValue: 0,
                        maxValue: 100,
                        minStep: this.fanFanspeedSteps
                    })
                    .on('get', this.getFanRotationSpeed.bind(this))
                    .on('set', this.setFanRotationSpeed.bind(this));
            }

            services.push(this.FanService);
        }

        if (this.manualControlSwitch) {
            this.ManualSwitchService = new Service.Switch(this.zoneName + " Manual");

            this.ManualSwitchService.getCharacteristic(Characteristic.On)
                .on('get', this.getManualSwitch.bind(this))
                .on('set', this.setManualSwitch.bind(this));

            services.push(this.ManualSwitchService);
        }

        return services;
    }



    /*********************************************************************************/
    /***********************************  GET COMMANDS  ******************************/
    /*********************************************************************************/

    // For HeaterCooler + Thermostat
    TadoAccessory.prototype.getActive = (callback) => {
        tadoHelpers.getCurrentStateResponse((state) => {
            if (state.setting.power == "OFF" || state.setting.mode == "FAN" || state.setting.mode == "DRY")
                callback(null, 0)
            else
                callback(null, 1)
        }).bind(this)
    }


    // For Thermostat
    TadoAccessory.prototype.getCurrentHeatingCoolingState = (callback) => {
        const accessory = this
        tadoHelpers.getCurrentStateResponse((state) => {
            this.log(accessory.zoneName + " Mode is ", state.setting.mode || state.setting.power)
            if (state.setting.power == "OFF" || state.setting.power == "FAN" || state.setting.power == "DRY")
                callback(null, Characteristic.CurrentHeatingCoolingState.OFF)
            else if (state.setting.mode == "COOL") 
                callback(null, Characteristic.CurrentHeatingCoolingState.COOL)
            else if (state.setting.mode == "HEAT")
                callback(null, Characteristic.CurrentHeatingCoolingState.HEAT)
            else if (state.setting.mode == "AUTO"){
                // trying to guess if the AC is Cooling or Heating since tado doesn't have temperature setting in AUTO mode
                const insideTemperature = state.sensorDataPoints.insideTemperature.celsius
                if (insideTemperature > 22)
                    callback(null, Characteristic.CurrentHeatingCoolingState.COOL)
                else
                    callback(null, Characteristic.CurrentHeatingCoolingState.HEAT)
            }
        }).bind(this)
    }

    // For Thermostat
    TadoAccessory.prototype.getTargetHeatingCoolingState = (callback) => {
        const accessory = this
        tadoHelpers.getCurrentStateResponse((state) => {
            this.log(accessory.zoneName + " Mode is ", state.setting.mode || state.setting.power)
            if (state.setting.power == "OFF" || state.setting.power == "FAN" || state.setting.power == "DRY")
                callback(null, Characteristic.TargetHeatingCoolingState.OFF)
            else if (state.setting.mode == "COOL") 
                callback(null, Characteristic.TargetHeatingCoolingState.COOL)
            else if (state.setting.mode == "HEAT")
                callback(null, Characteristic.TargetHeatingCoolingState.HEAT)
            else if (state.setting.mode == "AUTO")
                callback(null, Characteristic.TargetHeatingCoolingState.AUTO)
        }).bind(this)
    }

    // For Thermostat
    TadoAccessory.prototype.getTargetTemperature = (callback) => {
        const accessory = this
        tadoHelpers.getCurrentStateResponse((state) => {
            if (state.setting.power == "ON" && state.setting.mode !== "AUTO") {
                if (accessory.useFahrenheit)
                    accessory.log(accessory.zoneName + " Target Temperature is " + state.setting.temperature.fahrenheit + "ºF");
                else 
                    accessory.log(accessory.zoneName + " Target Temperature is " + state.setting.temperature.celsius + "ºC");
                callback(null, state.setting.temperature.celsius);
            } else if (state.setting.power == "ON" && state.setting.mode == "AUTO") 
                // returning 25 celsius degrees on auto mode since there is no temperture in Tado for AUTO mode
                callback(null, 25);
            else 
                callback(null, null)
        }).bind(this)
    }

    // For HeaterCooler
    TadoAccessory.prototype.getCurrentHeaterCoolerState = (callback) => {
        const accessory = this
        tadoHelpers.getCurrentStateResponse((state) => {
            this.log(accessory.zoneName + " Mode is ", state.setting.mode || state.setting.power)
            if (state.setting.power == "OFF" || state.setting.power == "FAN" || state.setting.power == "DRY")
                callback(null, Characteristic.CurrentHeaterCoolerState.INACTIVE)
            else if (state.setting.mode == "COOL") 
                callback(null, Characteristic.CurrentHeaterCoolerState.COOLING)
            else if (state.setting.mode == "HEAT")
                callback(null, Characteristic.CurrentHeaterCoolerState.HEATING)
            else if (state.setting.mode == "AUTO") {
                // trying to guess if the AC is Cooling or Heating since tado doesn't have temperature setting in AUTO mode
                const insideTemperature = state.sensorDataPoints.insideTemperature.celsius
                if (insideTemperature > 22)
                    callback(null, Characteristic.CurrentHeaterCoolerState.COOLING)
                else
                    callback(null, Characteristic.CurrentHeaterCoolerState.HEATING)
            }
        }).bind(this)
    }

    // For HeaterCooler
    TadoAccessory.prototype.getTargetHeaterCoolerState = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            // this.log(accessory.zoneName + " Target State is ", state.setting.power)
            if (state.setting.power == "OFF" || state.setting.power == "FAN" || state.setting.power == "DRY")
                callback();
            else if (state.setting.mode == "COOL") 
                callback(null, Characteristic.TargetHeaterCoolerState.COOL)
            else if (state.setting.mode == "HEAT")
                callback(null, Characteristic.TargetHeaterCoolerState.HEAT)
            else if (state.setting.mode == "AUTO")
                callback(null, Characteristic.TargetHeaterCoolerState.AUTO)
        }).bind(this)
    }

    // For HeaterCooler + Thermostat
    TadoAccessory.prototype.getCurrentTemperature = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            if (accessory.useFahrenheit)
                accessory.log(accessory.zoneName + " Current Temperature is " + state.sensorDataPoints.insideTemperature.fahrenheit + "ºF")
            else
                accessory.log(accessory.zoneName + " Current Temperature is " + state.sensorDataPoints.insideTemperature.celsius + "ºC")

            callback(null, state.sensorDataPoints.insideTemperature.celsius);
        }).bind(this)
    }

    // For HeaterCooler
    TadoAccessory.prototype.getCoolingThresholdTemperature = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            if (state.setting.power == "ON" && state.setting.mode == "COOL") {
                if (accessory.useFahrenheit)
                accessory.log(accessory.zoneName + " Target Temperature is " + state.setting.temperature.fahrenheit + "ºF");
                else 
                accessory.log(accessory.zoneName + " Target Temperature is " + state.setting.temperature.celsius + "ºC");

            } else if (state.setting.power == "ON" && state.setting.mode == "AUTO") 
                // returning 25 celsius degrees on auto mode since there is no temperture in Tado for AUTO mode
                callback(null, 25);
            else 
                callback(null, null)
        }).bind(this)
    }

    // For HeaterCooler
    TadoAccessory.prototype.getHeatingThresholdTemperature = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            if (state.setting.power == "ON" && state.setting.mode == "HEAT") {
                if (accessory.useFahrenheit)
                accessory.log(accessory.zoneName + " Target Temperature is " + state.setting.temperature.fahrenheit + "ºF");
                else 
                accessory.log(accessory.zoneName + " Target Temperature is " + state.setting.temperature.celsius + "ºC");

            } else if (state.setting.power == "ON" && state.setting.mode == "AUTO") 
                // returning 25 celsius degrees on auto mode since there is no temperture in Tado for AUTO mode
                callback(null, 25);
            else 
                callback(null, null)
        }).bind(this)
    }

    // For HeaterCooler + Thermostat
    TadoAccessory.prototype.getTemperatureDisplayUnits = (callback) => {
        //this.log("The current temperature display unit is " + (this.useFahrenheit ? "ºF" : "ºC"));
        callback(null, this.useFahrenheit ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS);
    }

    // For HeaterCooler
    TadoAccessory.prototype.getSwing = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            if (state.setting.power == "ON" && accessory.capabilities[state.setting.mode].swings)
                callback(null, state.setting.swing == "ON" ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED)
            else 
                callback(null, null)
        }).bind(this)

    }

    // For HeaterCooler
    TadoAccessory.prototype.getRotationSpeed = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            if (state.setting.power == "ON" && accessory.capabilities[state.setting.mode].fanSpeeds)
                callback(null, tadoHelpers.returnFanspeedValue(state.setting.fanSpeed).bind(accessory))
            else callback(null, null)
        }).bind(this)
    }

    // For HeaterCooler + Thermostat
    TadoAccessory.prototype.getCurrentRelativeHumidity = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            accessory.log(accessory.zoneName + " Humidity is " + state.sensorDataPoints.humidity.percentage + "%")
            callback(null, state.sensorDataPoints.humidity.percentage)
        }).bind(this)
    }

    // For Fan
    TadoAccessory.prototype.getFanActive = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            if (state.setting.power !== "OFF" && state.setting.mode == "FAN")
                callback(null, Characteristic.Active.ACTIVE)
            else
                callback(null, Characteristic.Active.INACTIVE)
        }).bind(this)
    }

    // For Fan
    TadoAccessory.prototype.getFanSwing = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
                if (state.setting.power == "ON" && state.setting.mode == "FAN" && accessory.capabilities["FAN"].swings)
                    callback(null, state.setting.swing == "ON" ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED)
                else 
                    callback(null, null)
        }).bind(this)
    }

    // For Fan
    TadoAccessory.prototype.getFanRotationSpeed = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            if (state.setting.power == "ON" && state.setting.mode == "FAN" && accessory.capabilities["FAN"].fanSpeeds)
                callback(null, tadoHelpers.returnFanFanspeedValue(state.setting.fanSpeed).bind(accessory))
            else callback(null, null)
        }).bind(this)
    }


    // For Manual Control Switch
    TadoAccessory.prototype.getManualSwitch = (callback) => {
        const accessory = this;
        tadoHelpers.getCurrentStateResponse((state) => {
            if (!state.overlay) 
                callback(null, false)
            else {
                accessory.log("Manual Control is ON!")
                callback(null, true)
            }
        }).bind(this)
    }


    /*********************************************************************************/
    /***********************************  SET COMMANDS  ******************************/
    /*********************************************************************************/

    // For HeaterCooler + Thermostat
    TadoAccessory.prototype.setActive = (state, callback) => {
        state = state === Characteristic.Active.ACTIVE ? "ON" : "OFF"
        tadoHelpers.setNewState('power', state)
        callback()
    }
    
    // For HeaterCooler
    TadoAccessory.prototype.setTargetHeaterCoolerState = (state, callback) => {
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
        tadoHelpers.setNewState('mode', state)
        callback()
    }

    // For Thermostat
    TadoAccessory.prototype.setTargetHeatingCoolingState = (state, callback) => {
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
        tadoHelpers.setNewState('mode', state)
        callback()
    }

    // For HeaterCooler + Thermostat
    TadoAccessory.prototype.setTargetTemperature = (temp, callback) => {
        tadoHelpers.setNewState('temp', temp)
        callback()
    }

    TadoAccessory.prototype.setSwing = (state, callback) => {
        state = state === Characteristic.SwingMode.SWING_ENABLED ? "ON" : "OFF"
        tadoHelpers.setNewState('swing', state)
        callback()
    }

    TadoAccessory.prototype.setRotationSpeed = (speed, callback) => {
        if (this.autoFanOnly)
            speed = "AUTO"
        else
            switch (Math.round(speed)) {
                case 100:
                    speed = "HIGH";
                    break;
                case Math.round(this.fanspeedSteps * 2):
                    speed = "MIDDLE";
                    break;
                case Math.round(this.fanspeedSteps):
                    speed = "LOW";
                    break;
            }
        tadoHelpers.setNewState('fanspeed', speed)
        callback()
    }

    TadoAccessory.prototype.setFanActive = (state, callback) => {
        state = state === Characteristic.Active.ACTIVE ? "ON" : "OFF"
        tadoHelpers.setNewState('fanPower', state)
        callback()
    }

    TadoAccessory.prototype.setFanSwing = (state, callback) => {
        state = state === Characteristic.SwingMode.SWING_ENABLED ? "ON" : "OFF"
        tadoHelpers.setNewState('fanSwing', state)
        callback()
    }

    TadoAccessory.prototype.setFanRotationSpeed = (speed, callback) => {
        if (this.autoFanOnly)
            speed = "AUTO"
        else
            switch (Math.round(speed)) {
                case 100:
                    speed = "HIGH";
                    break;
                case Math.round(this.fanspeedSteps * 2):
                    speed = "MIDDLE";
                    break;
                case Math.round(this.fanspeedSteps):
                    speed = "LOW";
                    break;
            }
        tadoHelpers.setNewState('fanFanspeed', speed)
        callback()
    }


    TadoAccessory.prototype.setManualSwitch = (state, callback) => {
        tadoHelpers.setNewState('manualControl', state ? "ON" : "OFF")
        callback()
    }


















    /********************************************************************************************************************************************************/
    /********************************************************************************************************************************************************/
    /*******************************************************************    TADO Weather   ******************************************************************/
    /********************************************************************************************************************************************************/
    /********************************************************************************************************************************************************/

    const TadoWeather = (log, config) => {
        this.log = log;
        this.name = "Outside Temperature";
        this.homeId = config.homeId;
        this.username = config.username;
        this.password = config.password;
        this.useFahrenheit = config.temperatureUnit == "CELSIUS" ? false : true;
        this.polling = config.polling;
        

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
            .setCharacteristic(Characteristic.Model, 'Tado Weather')
            .setCharacteristic(Characteristic.SerialNumber, 'Tado Serial Weather');

        this.TemperatureSensor = new Service.TemperatureSensor(this.name);

        this.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                maxValue: 100,
                minValue: -100,
                minStep: 1
            })
            .on('get', this.getOutsideTemperature.bind(this));

        this.SolarSensor = new Service.Lightbulb("Solar Intensity");

        this.SolarSensor.getCharacteristic(Characteristic.On)
            .on('get', this.getOn.bind(this))
            .on('set', this.setOn.bind(this));

        this.SolarSensor.getCharacteristic(Characteristic.Brightness)
            .setProps({
                maxValue: 100,
                minValue: 0,
                minStep: 1
            })
            .on('get', this.getSolar.bind(this))
            .on('set', this.setSolar.bind(this));


        if (this.polling) {
            const self = this
            setInterval(() => {
                tadoHelpers.getWeatherState((state) => {
                    self.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(state.temp)
                    self.SolarSensor.getCharacteristic(Characteristic.Brightness).updateValue(state.solar)
                    self.SolarSensor.getCharacteristic(Characteristic.On).updateValue(!!state.solar)
                }).bind(this)
                
            }, this.polling).bind(this)
        }
    }

    TadoWeather.prototype.getServices = () => {
        return [this.TemperatureSensor, this.informationService, this.SolarSensor]
    }

    TadoWeather.prototype.getOutsideTemperature = (callback) => {
        tadoHelpers.getWeatherState((state) => {
            callback(null, state.temp);
        }).bind(this)
    }

    TadoWeather.prototype.getSolar = (callback) => {
        tadoHelpers.getWeatherState((state) => {
            callback(null, state.solar);
        }).bind(this)
    }

    TadoWeather.prototype.getOn = (callback) => {
        tadoHelpers.getWeatherState((state) => {
            callback(null, !!state.solar);
        }).bind(this)
    }


    TadoWeather.prototype.setSolar = (state, callback) => {
        const accessory = this
        tadoHelpers.getWeatherState((state) => {
            accessory.SolarSensor.getCharacteristic(Characteristic.Brightness).updateValue(state.solar);
        }).bind(this)
    }

    TadoWeather.prototype.setOn = (state, callback) => {
        const accessory = this
        tadoHelpers.getWeatherState((state) => {
            if (state.solar)
                accessory.SolarSensor.getCharacteristic(Characteristic.On).updateValue(true)
            else
                accessory.SolarSensor.getCharacteristic(Characteristic.On).updateValue(false)
        }).bind(this)
    }










    /********************************************************************************************************************************************************/
    /********************************************************************************************************************************************************/
    /*******************************************************************   TADO Occupancy  ******************************************************************/
    /********************************************************************************************************************************************************/
    /********************************************************************************************************************************************************/

    const occupancySensor = (log, config, platform) => {
        this.log = log;
        this.platform = platform;
        this.name = config.name;
        this.deviceId = config.deviceId
        this.homeId = config.homeId;
        this.username = config.username;
        this.password = config.password;
        this.polling = config.polling;
        this.device = config.device
        this.occupied = false;

        this.options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + this.homeId + '/mobileDevices?password=' + this.password + '&username=' + this.username,
            method: 'GET'
        };

        this.checkOccupancy = function () {
            var self = this;
            https.request(self.options, function (response) {
                var strData = '';
                response.on('data', function (chunk) {
                    strData += chunk;
                });
                response.on('end', function () {
                    try {
                        var data = JSON.parse(strData);
                        for (i = 0; i < data.length; i++) {
                            if (data[i].id == self.deviceId) {
                                if (data[i].location !== null && data[i].location.atHome) {
                                    if (self.occupied == 0) {
                                        self.occupied = 1;
                                        self.log(self.name + " is at Home!");
                                        self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(self.occupied);
                                    }
                                } else {
                                    if (self.occupied == 1) {
                                        self.occupied = 0;
                                        self.log(self.name + " is Out!");
                                        self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(self.occupied);
                                    }
                                }
                            }
                        }
                    }
                    catch (e) {
                        self.log("Could not retrieve " + self.name + " Occupancy Status, error:" + e);
                        var error = new Error("Could not retrieve " + self.name + " Occupancy Status, error:" + e);
                        return;
                    }
                });
            }).on('error', (e) => {
                console.error(e);
                return;
            }).end();
        }


        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Manufacturer, 'Tado Occupancy')
            .setCharacteristic(Characteristic.Model, this.device.model)
            .setCharacteristic(Characteristic.SerialNumber, this.device.platform + " " + this.device.osVersion);

        this.OccupancySensor = new Service.OccupancySensor(this.name);

        this.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected)
            .on('get', this.getStatus.bind(this));


        var self = this;
        const updateResults = (state) => {
            self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(state);
        }

        if (this.name == "Anyone") {
            setTimeout(function () {
                tadoHelpers.checkOccupancy(updateResults)
                setInterval(function () {
                    tadoHelpers.checkOccupancy(updateResults)
                }, this.polling)
            }, 300).bind(this)

        } else {
            this.checkOccupancy();
            setInterval(function () {
                tadoHelpers.checkOccupancy(updateResults)
            }, this.polling)
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

        callback(null, this.occupied);
    }
