const https = require('https')
const getCallbacks = {}
const setCommands = {}
const weatherCallbacks = {}

const sampleState = {
    "setting": {
        "type": "AIR_CONDITIONING",
        "power": "OFF"
    },
    "overlay": {
        "type": "MANUAL",
        "setting": {
            "type": "AIR_CONDITIONING",
            "power": "OFF"
        },
        "termination": {
            "type": "MANUAL",
            "projectedExpiry": null
        }
    },
    "sensorDataPoints": {
        "insideTemperature": {
            "celsius": 21.5,
            "fahrenheit": 70.7,
            "type": "TEMPERATURE",
            "precision": {
                "celsius": 0.1,
                "fahrenheit": 0.1
            }
        },
        "humidity": {
            "type": "PERCENTAGE",
            "percentage": 70.3
        }
    }
}

const tadoHelpers = module.exports = (tadoApi, storage, Characteristic) => {


    storeToken: (err, newToken) => {
        if (err) {
            console.log('Couldn\'t Get Tado Token! trying again in 10 seconds')
            setTimeout(() => {
                tadoApi.getToken(this.username, this.password, storeToken)
            }, 10000).bind(this)
        } else {
            const lastToken = storage.getItem('Tado_Token')
            // this.log("New token: " + token)
            // this.log("Old Token: " + lastToken)
            if (lastToken !== newToken && newToken !== undefined)
                storage.setItem('Tado_Token', newToken)
        }
    }

    buildFirstOverlay: (capabilities, tadoMode, autoFanOnly, durationInMinutes) => {

        if (!Array.prototype.last) {
            Array.prototype.last = () => {
                return this[this.length - 1];
            };
        };

        const overlays = {}

        if (capabilities.COOL) {
            overlays.COOl = {
                "termination": {
                    "type": tadoMode
                },
                "setting": {
                    "power": "ON",
                    "type": "AIR_CONDITIONING",
                    "mode": "COOL",
                    "temperature": {
                        "fahrenheit": capabilities.COOL.temperatures.fahrenheit.min,
                        "celsius": capabilities.COOL.temperatures.celsius.min
                    }
                }
            }
            if (capabilities.COOL.fanSpeeds) {
                if (capabilities.COOL.fanSpeeds.includes('AUTO') && autoFanOnly)
                    overlays.COOl.setting.fanSpeed = "AUTO"
                else
                    overlays.COOl.setting.fanSpeed = capabilities.COOL.fanSpeeds.last()
            }
            if (capabilities.COOL.swings)
                overlays.COOl.setting.swing = "ON"
            if (tadoMode == "TIMER")
                overlays.COOl.termination.durationInSeconds = durationInMinutes * 60
        }

        if (capabilities.HEAT) {
            overlays.HEAT = {
                "termination": {
                    "type": tadoMode
                },
                "setting": {
                    "power": "ON",
                    "type": "AIR_CONDITIONING",
                    "mode": "HEAT",
                    "temperature": {
                        "fahrenheit": capabilities.HEAT.temperatures.fahrenheit.max,
                        "celsius": capabilities.HEAT.temperatures.celsius.max
                    }
                }
            }
            if (capabilities.HEAT.fanSpeeds) {
                if (capabilities.HEAT.fanSpeeds.includes('AUTO') && autoFanOnly)
                    overlays.HEAT.setting.fanSpeed = "AUTO"
                else
                    overlays.HEAT.setting.fanSpeed = capabilities.HEAT.fanSpeeds.last()
            }
            if (capabilities.HEAT.swings)
                overlays.HEAT.setting.swing = "ON"
            if (tadoMode == "TIMER")
                overlays.HEAT.termination.durationInSeconds = durationInMinutes * 60
        }


        if (capabilities.AUTO) {
            overlays.AUTO = {
                "termination": {
                    "type": tadoMode
                },
                "setting": {
                    "power": "ON",
                    "type": "AIR_CONDITIONING",
                    "mode": "AUTO"
                }
            }
            if (capabilities.AUTO.fanSpeeds) {
                if (capabilities.AUTO.fanSpeeds.includes('AUTO') && autoFanOnly)
                    overlays.AUTO.setting.fanSpeed = "AUTO"
                else
                    overlays.AUTO.setting.fanSpeed = capabilities.AUTO.fanSpeeds.last()
            }
            if (capabilities.AUTO.swings)
                overlays.AUTO.setting.swing = "ON"
            if (tadoMode == "TIMER")
                overlays.AUTO.termination.durationInSeconds = durationInMinutes * 60
        }

        if (capabilities.FAN) {
            overlays.FAN = {
                "termination": {
                    "type": tadoMode
                },
                "setting": {
                    "power": "ON",
                    "type": "AIR_CONDITIONING",
                    "mode": "FAN"
                }
            }
            if (capabilities.FAN.fanSpeeds) {
                if (capabilities.FAN.fanSpeeds.includes('AUTO') && autoFanOnly)
                    overlays.FAN.setting.fanSpeed = "AUTO"
                else
                    overlays.FAN.setting.fanSpeed = capabilities.FAN.fanSpeeds.last()
            }
            if (capabilities.FAN.swings)
                overlays.FAN.setting.swing = "ON"
            if (tadoMode == "TIMER")
                overlays.FAN.termination.durationInSeconds = durationInMinutes * 60
        }

        overlays.lastMode = "COOL"

        return overlays

    }

    returnFanspeedValue: (fanSpeed) => {
        if (fanSpeed === "AUTO" || fanSpeed === "HIGH")
            return 100;
        else if (fanSpeed === "MIDDLE")
            return (this.fanspeedSteps * 2)
        else if (fanSpeed === "LOW")
            return this.fanspeedSteps
    }


    returnFanFanspeedValue: (fanSpeed) => {
        if (fanSpeed === "AUTO" || fanSpeed === "HIGH")
            return 100;
        else if (fanSpeed === "MIDDLE")
            return (this.fanFanspeedSteps * 2)
        else if (fanSpeed === "LOW")
            return this.fanFanspeedSteps
    }


    getCurrentStateResponse: (callback, isPollCall) => {

        if (!getCallbacks[this.zone] || !getCallbacks[this.zone].callbacks.length)
            getCallbacks[this.zone] = {
                callbacks: [callback],
                processing: false
            }
        else
            getCallbacks[this.zone].callbacks.push(callback)

        if (!getCallbacks[this.zone].processing) {
            getCallbacks[this.zone].processing = true

            // check if it's polling request or if polling is enabled
            if (this.statePollingInterval && this.lastState && !isPollCall) {
                // wait for all commends before sending back response
                setTimeout(() => {
                    getCallbacks[this.zone].callbacks.forEach(callback => {
                        callback(this.lastState)
                    })
                    getCallbacks[this.zone].processing = false
                    getCallbacks[self.zone].callbacks = []
                }, 500)
            }

            const self = this
            tadoApi.getState(this.username, this.password, this.homeId, zone.id, (err, state) => {
                if (err) {
                    self.log('XXX - Error Getting Zone ' + zone.id + ' State - XXX')
                    self.log('----> Returning last state to avoid HomeBridge error <----')
                    getCallbacks[self.zone].processing = false
                    if (self.lastState)
                        getCallbacks[self.zone].callbacks.forEach(callback => {
                            callback(self.lastState)
                        })
                    else {
                        self.log('---->  No "Last State" in Memory  - Returning sample state...')
                        getCallbacks[self.zone].callbacks.forEach(callback => {
                            callback(sampleState)
                        })
                    }
                    getCallbacks[self.zone].callbacks = []
                } else {
                    self.lastState = state
                    // update state according to config (before storing)
                    if (state.setting.power !== "OFF") {
                        const newState = {
                            "setting": state.setting
                        }
                        if (self.tadoMode == "TIMER")
                            newState.termination = { "type": "TIMER", "durationInSeconds": self.durationInMinutes * 60 }
                        else
                            newState.termination = { "type": self.tadoMode }
                        if (self.capabilities[state.setting.mode].fanSpeeds.includes["AUTO"] && self.autoFanOnly) state.setting.fanSpeed = "AUTO"

                        self.lastOverlay[state.setting.mode] = newState
                        if (state.setting.mode === "COOL" || state.setting.mode === "HEAT" || state.setting.mode === "AUTO")
                            self.lastOverlay.lastMode = state.setting.mode

                        storage.setItem(self.name, self.lastOverlay)
                    }

                    getCallbacks[self.zone].processing = false
                    if (self.statePollingInterval && !isPollCall)
                        tadoHelpers.updateAccessoryState(state)
                    else {
                        getCallbacks[self.zone].callbacks.forEach(callback => {
                            callback(state)
                        })
                        getCallbacks[self.zone].callbacks = []
                    }

                }
            })
        }
    }


    updateAccessoryState: (state) => {

        const insideTemperature = state.sensorDataPoints.insideTemperature.celsius

        if (this.forceThermostat || this.isThermostatic) {

            // Update Thermostat
            if (state.setting.power == "OFF" || state.setting.mode == "FAN" || state.setting.mode == "DRY") {
                this.thermostatService.getCharacteristic(Characteristic.On).updateValue(0);
                this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.OFF);
                this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.OFF);
            } else {
                this.thermostatService.getCharacteristic(Characteristic.On).updateValue(1);
                if (state.setting.mode == "COOL") {
                    this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.COOL)
                    this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.COOL)
                    this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(state.setting.temperature.celsius)
                } else if (state.setting.mode == "HEAT") {
                    this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.HEAT)
                    this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.HEAT)
                    this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(state.setting.temperature.celsius)
                } else if (state.setting.mode == "AUTO") {
                    // trying to guess if the AC is Cooling or Heating since tado doesn't have temperature setting in AUTO mode

                    this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.AUTO)
                    if (insideTemperature > 22)
                        this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.COOL)
                    else
                        this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.HEAT)

                    this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(25)
                }

            }
            this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(insideTemperature)
            this.thermostatService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(state.sensorDataPoints.humidity.percentage)

        } else {

            // Update HeaterCooler
            if (state.setting.power == "OFF" || state.setting.mode == "FAN" || state.setting.mode == "DRY") {
                this.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(0);
                this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.OFF);
            } else {
                this.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(1);
                if (this.capabilities[state.setting.mode].swings)
                    this.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode).updateValue(state.setting.swing == "ON" ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED)
                if (this.capabilities[state.setting.mode].fanSpeeds)
                    this.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(tadoHelpers.returnFanspeedValue(state.setting.fanSpeed).bind(this))
                if (state.setting.mode == "COOL") {
                    this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.COOLING)
                    this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.COOL)
                    this.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(state.setting.temperature.celsius)


                } else if (state.setting.mode == "HEAT") {
                    this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.HEATING)
                    this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.HEAT)
                    this.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(state.setting.temperature.celsius)
                } else if (state.setting.mode == "AUTO") {
                    // trying to guess if the AC is Cooling or Heating since tado doesn't have temperature setting in AUTO mode

                    this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.AUTO)
                    if (insideTemperature > 22)
                        this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.COOLING)
                    else
                        this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.HEATING)

                    this.HeaterCoolerService.getCharacteristic(Characteristic.TargetTemperature).updateValue(25)
                }

            }
            this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(insideTemperature)
            if (!this.disableHumiditySensor) this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(state.sensorDataPoints.humidity.percentage)

            // Update Fan
            if (this.capabilities.FAN && !this.disableFan) {
                if (state.setting.power !== "OFF" && state.setting.mode == "FAN") {
                    this.FanService.getCharacteristic(Characteristic.Active).updateValue(1)
                    if (this.capabilities["FAN"].swings)
                        this.FanService.getCharacteristic(Characteristic.SwingMode).updateValue(state.setting.swing == "ON" ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED)
                    if (this.capabilities["FAN"].fanSpeeds)
                        this.FanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(tadoHelpers.returnFanFanspeedValue(state.setting.fanSpeed).bind(this))
                } else
                    this.FanService.getCharacteristic(Characteristic.Active).updateValue(0)
            }
        }

        // Update Manual Control Switch
        if (this.manualControlSwitch) {
            if (!state.overlay)
                this.ManualSwitchService.getCharacteristic(Characteristic.On).updateValue(0)
            else
                this.ManualSwitchService.getCharacteristic(Characteristic.On).updateValue(1)
        }
    }

    setNewState: (command, state) => {
        const token = storage.getItem('Tado_Token');
        if (!setCommands[this.zone])
            setCommands[this.zone] = {
                commands = {},
                processing: false
            }
        setCommands[this.zone].commands[command] = state

        if (!setCommands[this.zone].processing) {
            setCommands[this.zone].processing = true

            setTimeout(() => {
                const commands = setCommands[this.zone].commands
                const overlayMode = storage.getItem(this.name).lastMode
                if (commands[manualControl] && commands[manualControl] === "OFF") {
                    //  Turning Off Manual Control
                    this.log("Turning OFF " + this.zoneName + " Manual Control")
                    tadoApi.setOverlay(this.username, this.password, this.homeId, this.zone, null, token)
                    accessory.log("Turning OFF " + accessory.zoneName + " AC")

                    //  updating all relveant services
                    if (this.isThermostatic || this.forceThermostat) {
                        this.thermostatService.getCharacteristic(Characteristic.On).updateValue(0);
                        this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.OFF);
                        this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.OFF);
                    } else {
                        this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.INACTIVE);
                        this.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE);
                        if (!this.disableFan && this.capabilities['FAN']) { this.FanService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE) }
                    }

                    //  sending OFF command for all scenarios
                } else if ((commands['fanPower'] === "OFF" || commands['power'] === "OFF" || commands['mode'] === "OFF")
                    && (commands['fanPower'] !== "ON" && commands['power'] !== "ON" && (commands['mode'] === "OFF" || !commands['mode']))) {

                    this.log("Turning OFF " + this.zoneName + " AC")
                    tadoApi.setOverlay(this.username, this.password, this.homeId, this.zone, this.offOverlay, token)

                } else {
                    if (commands[manualControl] && commands[manualControl] === "ON")
                        this.log("Turning ON " + this.zoneName + " Manual Control")

                    if (commands['fanPower'] && commands['fanPower'] === "ON")
                        overlayMode = 'FAN'

                    if (commands['fanSwing'] && this.capabilities[FAN].swings) {
                        this.lastOverlay['FAN'].setting.swing = commands['fanSwing']
                        overlayMode = 'FAN'
                    }

                    if (commands['fanFanspeed'] && this.capabilities[FAN].fanSpeeds && this.capabilities[FAN].fanSpeeds.includes[commands['fanFanspeed']]) {
                        this.lastOverlay['FAN'].setting.fanSpeed = commands['fanFanspeed']
                        overlayMode = 'FAN'
                    }

                    // switching mode when received
                    if (commands['mode'] && commands['mode'] !== "OFF") {
                        if (this.capabilities[commands['mode']]) {
                            overlayMode = commands['mode']
                            this.lastOverlay.lastMode = commands['mode']
                        }
                    }

                    if (commands['temp']) {
                        this.lastOverlay[overlayMode].setting.temperature.fahrenheit = Math.round(commands['temp'] * 9 / 5 + 32)
                        this.lastOverlay[overlayMode].setting.temperature.celsius = commands['temp']
                    }

                    if (commands['swing'] && this.capabilities[overlayMode].swings)
                        this.lastOverlay[overlayMode].setting.swing = commands['swing']

                    if (commands['fanspeed'] && this.capabilities[overlayMode].fanSpeeds && this.capabilities[overlayMode].fanSpeeds.includes[commands['fanspeed']])
                        this.lastOverlay[overlayMode].setting.fanSpeed = commands['fanspeed']

                    this.log('Setting new state on ' + this.zoneName + " -->")
                    this.log(this.lastOverlay[overlayMode])

                    tadoApi.setOverlay(this.username, this.password, this.homeId, this.zone, this.lastOverlay[overlayMode], token)

                    // Update Manual Control
                    if (this.manualControlSwitch)
                        this.ManualSwitchService.getCharacteristic(Characteristic.On).updateValue(true)

                    // Turn OFF AC when FAN is ON and vice versa
                    if (overlayMode === 'FAN') {
                        this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.INACTIVE);
                        this.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE);
                    } else {
                        if (!this.disableFan && this.capabilities['FAN']) { this.FanService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE) }
                    }

                }


            }, 500).bind(this)
        }
    }

    getWeatherState: (callback, isPollCall) => {

        if (!weatherCallbacks.callbacks || !weatherCallbacks.callbacks.length)
            weatherCallbacks = {
                callbacks: [callback],
                processing: false
            }
        else
            weatherCallbacks.callbacks.push(callback)

        if (!weatherCallbacks.processing) {
            weatherCallbacks.processing = true


            // check if it's polling request or if polling is enabled
            if (this.polling && this.lastState && !isPollCall) {
                // wait for all commends before sending back response
                setTimeout(() => {
                    weatherCallbacks.callbacks.forEach(callback => {
                        callback(this.lastState)
                    })
                    weatherCallbacks.processing = false
                    weatherCallbacks.callbacks = []
                }, 500)
            }

            const self = this
            tadoApi.getWeather(this.username, this.password, this.homeId, (err, state) => {
                if (err) {
                    self.log('XXX - Error Getting Weather - XXX')
                    weatherCallbacks.processing = false
                    if (self.lastState)
                        weatherCallbacks.callbacks.forEach(callback => {
                            callback(self.lastState)
                        })
                    else {
                        self.log('---->  No "Last State" in Memory  - Returning 0')
                        getCallbacks[self.zone].callbacks.forEach(callback => {
                            callback({
                                solar: 0,
                                temp: 0
                            })
                        })
                    }
                } else {

                    var solar = state.solarIntensity.percentage
                    var outsideTemperature = self.useFahrenheit ? state.outsideTemperature.fahrenheit : state.outsideTemperature.celsius
                    
                    if (!isPollCall) {
                        self.log("Solar Intensity is " + solar + "%")
                        if (self.useFahrenheit)
                            self.log("Outside Temperature is " + outsideTemperature.fahrenheit + "ºF")
                        else
                            self.log("Outside Temperature is " + outsideTemperature.celsius + "ºC")
                    }

                    self.lastState = {
                        solar: solar,
                        temp: outsideTemperature
                    }

                    weatherCallbacks.processing = false
                    if (self.polling && !isPollCall){
                        self.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.lastState.temp)
                        self.SolarSensor.getCharacteristic(Characteristic.Brightness).updateValue(self.lastState.solar)
                        self.SolarSensor.getCharacteristic(Characteristic.On).updateValue(!!self.lastState.solar)
                    } else {
                        weatherCallbacks.callbacks.forEach(callback => {
                            callback(state)
                        })
                        weatherCallbacks.callbacks = []
                    }

                }
            })
        }
    }

    checkOccupancy: (callback) => {

        if (this.name === "Anyone") {
            const anyoneOccupied = this.platform.occupancySensors.find(sensor => sensor.occupied) 
            this.occupied = anyoneOccupied === null ? 0 : 1
            callback(this.occupied)
        } else {
            const self = this
            tadoApi.getMobileDevices(this.username, this.password, this.homeId, (err, state) => {
                if (err) {
                    self.log('XXX - Error Getting Occupancy Status for ' + self.name + ' - Returning last state! - XXX')
                    callback(self.occupied)
                } else {
                    const device = state.find(mobile => mobile.id == self.deviceId)
                    if (device.location !== null && device.location.atHome)
                        if (!self.occupied) {
                            self.occupied = 1;
                            self.log(self.name + " is at Home!");
                        }
                    else
                        if (self.occupied) {
                            self.occupied = 0;
                            self.log(self.name + " is Out!");
                        }
                    callback(self.occupied)
                }
            })
        }
    }
}