const https = require('https')
let getCallbacks = {}
let setCommands = {}
let weatherCallbacks = {}

const sampleState = {
    'setting': {
        'type': 'AIR_CONDITIONING',
        'power': 'OFF'
    },
    'overlay': {
        'type': 'MANUAL',
        'setting': {
            'type': 'AIR_CONDITIONING',
            'power': 'OFF'
        },
        'termination': {
            'type': 'MANUAL',
            'projectedExpiry': null
        }
    },
    'sensorDataPoints': {
        'insideTemperature': {
            'celsius': 21.5,
            'fahrenheit': 70.7,
            'type': 'TEMPERATURE',
            'precision': {
                'celsius': 0.1,
                'fahrenheit': 0.1
            }
        },
        'humidity': {
            'type': 'PERCENTAGE',
            'percentage': 70.3
        }
    }
}
module.exports = (tadoApi, storage, Characteristic) => {

    tadoHelpers = {
        storeToken: function(err, newToken) {
            if (err) {
                console.error('Couldn\'t Get Tado Token! trying again in 10 seconds')
                setTimeout(() => {
                    tadoApi.getToken(this.username, this.password, tadoHelpers.storeToken.bind(this))
                }, 10000)
            } else {
                const lastToken = storage.getItem('Tado_Token')
                if (this.debug) this.log('Old Token: ', lastToken)
                if (this.debug) this.log('New token: ', newToken)
                if (lastToken !== newToken && newToken !== undefined)
                    storage.setItem('Tado_Token', newToken)
            }
        },

        buildOverlay: (capabilities, tadoMode, autoFanOnly, durationInMinutes, lastStorage) => {

            const overlays = {}

            if (capabilities.COOL) {
                overlays.COOL = {
                    'termination': {
                        'type': tadoMode
                    },
                    'setting': {
                        'power': 'ON',
                        'type': 'AIR_CONDITIONING',
                        'mode': 'COOL',
                        'temperature': {
                            'fahrenheit': capabilities.COOL.temperatures.fahrenheit.min,
                            'celsius': capabilities.COOL.temperatures.celsius.min
                        }
                    }
                }
                if (lastStorage && lastStorage.COOL) 
                    overlays.COOL.setting.temperature = lastStorage.COOL.setting.temperature
                if (capabilities.COOL.fanSpeeds) {
                    if (capabilities.COOL.fanSpeeds.includes('AUTO') && autoFanOnly)
                        overlays.COOL.setting.fanSpeed = 'AUTO'
                    else
                        overlays.COOL.setting.fanSpeed = capabilities.COOL.fanSpeeds[capabilities.COOL.fanSpeeds.length - 1]
                }
                if (capabilities.COOL.swings)
                    overlays.COOL.setting.swing = 'ON'
                if (tadoMode == 'TIMER')
                    overlays.COOL.termination.durationInSeconds = durationInMinutes * 60
            }

            if (capabilities.HEAT) {
                overlays.HEAT = {
                    'termination': {
                        'type': tadoMode
                    },
                    'setting': {
                        'power': 'ON',
                        'type': 'AIR_CONDITIONING',
                        'mode': 'HEAT',
                        'temperature': {
                            'fahrenheit': capabilities.HEAT.temperatures.fahrenheit.max,
                            'celsius': capabilities.HEAT.temperatures.celsius.max
                        }
                    }
                }
                if (lastStorage && lastStorage.HEAT) 
                    overlays.HEAT.setting.temperature = lastStorage.HEAT.setting.temperature
                if (capabilities.HEAT.fanSpeeds) {
                    if (capabilities.HEAT.fanSpeeds.includes('AUTO') && autoFanOnly)
                        overlays.HEAT.setting.fanSpeed = 'AUTO'
                    else
                        overlays.HEAT.setting.fanSpeed = capabilities.HEAT.fanSpeeds[capabilities.HEAT.fanSpeeds.length - 1]
                }
                if (capabilities.HEAT.swings)
                    overlays.HEAT.setting.swing = 'ON'
                if (tadoMode == 'TIMER')
                    overlays.HEAT.termination.durationInSeconds = durationInMinutes * 60
            }


            if (capabilities.AUTO) {
                overlays.AUTO = {
                    'termination': {
                        'type': tadoMode
                    },
                    'setting': {
                        'power': 'ON',
                        'type': 'AIR_CONDITIONING',
                        'mode': 'AUTO'
                    }
                }
                if (capabilities.AUTO.fanSpeeds) {
                    if (capabilities.AUTO.fanSpeeds.includes('AUTO') && autoFanOnly)
                        overlays.AUTO.setting.fanSpeed = 'AUTO'
                    else
                        overlays.AUTO.setting.fanSpeed = capabilities.AUTO.fanSpeeds[capabilities.AUTO.fanSpeeds.length - 1]
                }
                if (capabilities.AUTO.swings)
                    overlays.AUTO.setting.swing = 'ON'
                if (tadoMode == 'TIMER')
                    overlays.AUTO.termination.durationInSeconds = durationInMinutes * 60
            }

            if (capabilities.FAN) {
                overlays.FAN = {
                    'termination': {
                        'type': tadoMode
                    },
                    'setting': {
                        'power': 'ON',
                        'type': 'AIR_CONDITIONING',
                        'mode': 'FAN'
                    }
                }
                if (capabilities.FAN.fanSpeeds) {
                    if (capabilities.FAN.fanSpeeds.includes('AUTO') && autoFanOnly)
                        overlays.FAN.setting.fanSpeed = 'AUTO'
                    else
                        overlays.FAN.setting.fanSpeed = capabilities.FAN.fanSpeeds[capabilities.FAN.fanSpeeds.length - 1]
                }
                if (capabilities.FAN.swings)
                    overlays.FAN.setting.swing = 'ON'
                if (tadoMode == 'TIMER')
                    overlays.FAN.termination.durationInSeconds = durationInMinutes * 60
            }

            if (lastStorage && capabilities[lastStorage.lastMode]) 
                overlays.lastMode = lastStorage.lastMode
            else
                overlays.lastMode = 'COOL'

            return overlays

        },

        returnFanspeedValue: (fanSpeed, fanspeedSteps) => {
            // console.log(fanSpeed, fanspeedSteps)
            if (fanSpeed === 'AUTO' || fanSpeed === 'HIGH')
                return 100
            else if (fanSpeed === 'MIDDLE')
                return (fanspeedSteps * 2)
            else if (fanSpeed === 'LOW')
                return fanspeedSteps
        },

        getCurrentStateResponse: function(callback, isPollCall) {

            if (this.statePollingInterval && !isPollCall) {
                if (this.debug) this.log('Sending immediate callbacks to', this.name)
                callback(this.lastState)
            }
            if (!getCallbacks[this.zone] || !getCallbacks[this.zone].callbacks.length)
                getCallbacks[this.zone] = {
                    callbacks: [callback],
                    processing: false
                }
            else
                getCallbacks[this.zone].callbacks.push(callback)

            if (!getCallbacks[this.zone].processing) {
                getCallbacks[this.zone].processing = true
                if (this.debug) this.log('Getting State for ', this.name)

                const self = this
                tadoApi.getState(this.username, this.password, this.homeId, this.zone, (err, state) => {
                    if (err) {
                        self.log('XXX - Error Getting Zone ' + this.zone + ' State - XXX')
                        self.log('----> Returning last state to avoid HomeBridge error <----')
                        if (self.lastState) {
                            if (self.debug) self.log('Sending', getCallbacks[self.zone].callbacks.length, 'lastState callbacks to', self.name)
                            getCallbacks[self.zone].callbacks.forEach(callback => {
                                callback(self.lastState)
                            })
                        } else {
                            self.log('---->  No \'Last State\' in Memory  - Returning sample state...')
                            if (self.debug) self.log('Sending', getCallbacks[self.zone].callbacks.length, 'sampleState callbacks to', self.name)
                            getCallbacks[self.zone].callbacks.forEach(callback => {
                                callback(sampleState)
                            })
                        }
                        delete getCallbacks[self.zone]
                    } else {
                        if (self.debug) self.log(state)
                        // update state according to config (before storing)
                        if (state.setting.power !== 'OFF') {
                            const newOverlay = {
                                'setting': state.setting
                            }
                            if (self.tadoMode == 'TIMER')
                                newOverlay.termination = { 'type': 'TIMER', 'durationInSeconds': self.durationInMinutes * 60 }
                            else
                            newOverlay.termination = { 'type': self.tadoMode }
                            if (self.capabilities[state.setting.mode].fanSpeeds && self.capabilities[state.setting.mode].fanSpeeds.includes('AUTO') && self.autoFanOnly) 
                                newOverlay.setting.fanSpeed = 'AUTO'

                            self.lastOverlay[state.setting.mode] = newOverlay
                            if (state.setting.mode === 'COOL' || state.setting.mode === 'HEAT' || state.setting.mode === 'AUTO')
                                self.lastOverlay.lastMode = state.setting.mode

                            storage.setItem(self.name, self.lastOverlay)
                        }

                        if (isPollCall || self.statePollingInterval ) {
                            if (!setCommands[self.zone]) {
                                if (self.debug && !isPollCall) self.log('Callbacks already sent updating Characteristic for ', self.name)
                                self.updateAccessoryState(state, self.lastState)
                            } else
                                if (self.debug) self.log('Not updating Characteristics while command is sent: ', self.name)
                        } else {
                            self.lastState = state
                            if (this.debug) this.log('Sending', getCallbacks[this.zone].callbacks.length, 'callbacks to', this.name)
                            getCallbacks[self.zone].callbacks.forEach(callback => {
                                callback(state)
                            })
                        }
                        delete getCallbacks[self.zone]
                    }
                })
            }
        },


        updateAccessoryState: function(state, oldState) {
            if (this.debug) this.log('Updating Accessory for', this.name)
            const insideTemperature = state.sensorDataPoints.insideTemperature
            if (this.forceThermostat || this.isThermostatic) {

                // Update Thermostat
                if (state.setting.power == 'OFF' || state.setting.mode == 'FAN' || state.setting.mode == 'DRY') {
                    if (oldState.setting.power !== 'OFF' && oldState.setting.mode !== 'FAN' && oldState.setting.mode !== 'DRY' && !setCommands[this.zone]){
                        this.log(this.name,'*New State* - Mode -', state.setting.power == 'OFF' ? state.setting.power : state.setting.mode)
                        this.thermostatService.getCharacteristic(Characteristic.On).updateValue(0)
                        this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.OFF)
                        this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.OFF)
                    }
                } else {
                    if (oldState.setting.mode !== state.setting.mode && !setCommands[this.zone]){
                        this.thermostatService.getCharacteristic(Characteristic.On).updateValue(1)
                        this.log(this.name,'*New State* - Mode -', state.setting.mode)
                    }
                    if (state.setting.mode == 'COOL') {
                        if (oldState.setting.mode !== state.setting.mode && !setCommands[this.zone]){
                            this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.COOL)
                            this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.COOL)
                        }
                        if ((!oldState.setting.temperature || oldState.setting.temperature.celsius !== state.setting.temperature.celsius) && !setCommands[this.zone]){
                            if (this.useFahrenheit)
                                this.log(this.name,'*New State* - Target Temperature -', state.setting.temperature.fahrenheit,'ºF')
                            else
                                this.log(this.name,'*New State* - Target Temperature -', state.setting.temperature.celsius,'ºC')
                            this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(state.setting.temperature.celsius)
                        }
                    } else if (state.setting.mode == 'HEAT') {
                        if (oldState.setting.mode !== state.setting.mode && !setCommands[this.zone]){
                            this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.HEAT)
                            this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.HEAT)
                        }
                        if ((!oldState.setting.temperature || oldState.setting.temperature.celsius !== state.setting.temperature.celsius) && !setCommands[this.zone]){
                            if (this.useFahrenheit)
                                this.log(this.name,'*New State* - Target Temperature -', state.setting.temperature.fahrenheit,'ºF')
                            else
                                this.log(this.name,'*New State* - Target Temperature -', state.setting.temperature.celsius,'ºC')
                            this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(state.setting.temperature.celsius)
                        }
                    } else if (state.setting.mode == 'AUTO' && !setCommands[this.zone]) {
                        // trying to guess if the AC is Cooling or Heating since tado doesn't have temperature setting in AUTO mode
                        this.thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState).updateValue(Characteristic.TargetHeatingCoolingState.AUTO)
                        if (insideTemperature.celsius > 22)
                            this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.COOL)
                        else
                            this.thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState).updateValue(Characteristic.CurrentHeatingCoolingState.HEAT)
                            this.thermostatService.getCharacteristic(Characteristic.TargetTemperature).updateValue(25)
                    }
                    
                }
                
                if (oldState.sensorDataPoints.insideTemperature.celsius !== insideTemperature.celsius && !setCommands[this.zone]) {
                    if (this.useFahrenheit)
                        this.log(this.name,'*New State* - Room Temperature -', insideTemperature.fahrenheit,'ºF')
                    else
                        this.log(this.name,'*New State* - Room Temperature -', insideTemperature.celsius,'ºC')
                    this.thermostatService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(insideTemperature.celsius)
                }
                
                if (!this.disableHumiditySensor && oldState.sensorDataPoints.humidity.percentage !== state.sensorDataPoints.humidity.percentage && !setCommands[this.zone]) {
                    this.log(this.name,'*New State* - Relative Humidity -', state.sensorDataPoints.humidity.percentage,'%')
                    this.thermostatService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(state.sensorDataPoints.humidity.percentage)
                }

            } else {

                // Update HeaterCooler
                if (state.setting.power == 'OFF' || state.setting.mode == 'FAN' || state.setting.mode == 'DRY') {
                    if (oldState.setting.power !== 'OFF' && oldState.setting.mode !== 'FAN' && oldState.setting.mode !== 'DRY' && !setCommands[this.zone]){

                        this.log(this.name,'*New State* - Mode -', state.setting.power == 'OFF' ? state.setting.power : state.setting.mode)
                        this.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(0)
                        this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.OFF)
                    }
                } else {

                    if (oldState.setting.mode !== state.setting.mode && !setCommands[this.zone]){
                        this.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(1)
                        this.log(this.name,'*New State* - Mode -', state.setting.mode)
                    }

                    if (this.capabilities[state.setting.mode].swings && oldState.setting.swing !== state.setting.swing && !setCommands[this.zone]){
                        this.log(this.name,'*New State* - Swing -', state.setting.swing)
                        this.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode).updateValue(state.setting.swing == 'ON' ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED)
                    }
                    if (this.capabilities[state.setting.mode].fanSpeeds && oldState.setting.fanSpeed !== state.setting.fanSpeed && !setCommands[this.zone]){
                        this.log(this.name,'*New State* - Fan Speed -', state.setting.fanSpeed)
                        this.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(tadoHelpers.returnFanspeedValue(state.setting.fanSpeed, this.fanspeedSteps))
                    }
                            
                    if (state.setting.mode == 'COOL') {
                        if (oldState.setting.mode !== state.setting.mode && !setCommands[this.zone]) {
                            this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.COOLING)
                            this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.COOL)
                        }
                        if ((!oldState.setting.temperature || oldState.setting.temperature.celsius !== state.setting.temperature.celsius) && !setCommands[this.zone]){
                            if (this.useFahrenheit)
                                this.log(this.name,'*New State* - Cooling Threshold Temperature -', state.setting.temperature.fahrenheit,'ºF')
                            else
                                this.log(this.name,'*New State* - Cooling Threshold Temperature -', state.setting.temperature.celsius,'ºC')
                            this.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(state.setting.temperature.celsius)
                        }


                    } else if (state.setting.mode == 'HEAT') {
                        if (oldState.setting.mode !== state.setting.mode && !setCommands[this.zone]) {
                            this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.HEATING)
                            this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.HEAT)
                        }
                        if (!oldState.setting.temperature || oldState.setting.temperature.celsius !== state.setting.temperature.celsius && !setCommands[this.zone]){
                            if (this.useFahrenheit)
                                this.log(this.name,'*New State* - Heating Threshold Temperature -', state.setting.temperature.fahrenheit,'ºF')
                            else
                                this.log(this.name,'*New State* - Heating Threshold Temperature -', state.setting.temperature.celsius,'ºC')
                            this.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(state.setting.temperature.celsius)
                        }
                        
                    } else if (state.setting.mode == 'AUTO' && !setCommands[this.zone]) {
                        // trying to guess if the AC is Cooling or Heating since tado doesn't have temperature setting in AUTO mode

                        this.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.AUTO)
                        if (insideTemperature.celsius > 22)
                            this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.COOLING)
                        else
                            this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.HEATING)

                        this.HeaterCoolerService.getCharacteristic(Characteristic.TargetTemperature).updateValue(25)
                    }
                }
                if (oldState.sensorDataPoints.insideTemperature.celsius !== insideTemperature.celsius && !setCommands[this.zone]) {
                    if (this.useFahrenheit)
                        this.log(this.name,'*New State* - Room Temperature -', insideTemperature.fahrenheit,'ºF')
                    else
                        this.log(this.name,'*New State* - Room Temperature -', insideTemperature.celsius,'ºC')
                    this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(insideTemperature.celsius)
                }
                
                if (!this.disableHumiditySensor && oldState.sensorDataPoints.humidity.percentage !== state.sensorDataPoints.humidity.percentage && !setCommands[this.zone]) {
                    this.log(this.name,'*New State* - Relative Humidity -', state.sensorDataPoints.humidity.percentage,'%')
                    this.HeaterCoolerService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(state.sensorDataPoints.humidity.percentage)   
                }

            }


            if (this.extraHumiditySensor && oldState.sensorDataPoints.humidity.percentage !== state.sensorDataPoints.humidity.percentage && !setCommands[this.zone]) {
                if (this.disableHumiditySensor) this.log(this.name,'(Extra Humidity Sensor) *New State* - Relative Humidity -', state.sensorDataPoints.humidity.percentage,'%')
                this.HumiditySensorService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(state.sensorDataPoints.humidity.percentage)   
            }

            // Update Fan
            if (this.capabilities.FAN && !this.disableFan && !setCommands[this.zone]) {
                if (state.setting.power !== 'OFF' && state.setting.mode == 'FAN') {
                    if ((oldState.setting.power === 'OFF' || oldState.setting.mode !== 'FAN') && !setCommands[this.zone]) {
                        this.log(this.name,'(Fan) *New State* - Status - ON')
                        this.FanService.getCharacteristic(Characteristic.Active).updateValue(1)
                    }
                    if (this.capabilities['FAN'].swings && oldState.setting.swing !== state.setting.swing && !setCommands[this.zone]){
                        this.log(this.name,'(Fan) *New State* - Swing -', state.setting.swing)
                        this.FanService.getCharacteristic(Characteristic.SwingMode).updateValue(state.setting.swing == 'ON' ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED)
                    }
                        
                    if (this.capabilities['FAN'].fanSpeeds && (oldState.setting.fanSpeeds !== state.setting.fanSpeeds || oldState.setting.mode !== 'FAN') && !setCommands[this.zone]){
                        this.log(this.name,'(Fan) *New State* - Fan Speed -', state.setting.fanSpeed)
                        this.FanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(tadoHelpers.returnFanspeedValue(state.setting.fanSpeed, this.fanFanspeedSteps))
                    }
                        
                } else {
                    if (oldState.setting.mode == 'FAN' && !setCommands[this.zone]) {
                        this.log(this.name,'(Fan) *New State* - Status - OFF')
                        this.FanService.getCharacteristic(Characteristic.Active).updateValue(0)
                    }
                }
            }

            // Update Manual Control Switch
            if (this.manualControlSwitch) {
                if (!state.overlay && oldState.overlay && !setCommands[this.zone]){
                    this.log(this.name,'(Fan) *New State* - Updating Manual - OFF')
                    this.ManualSwitchService.getCharacteristic(Characteristic.On).updateValue(0)
                } else if (state.overlay && !oldState.overlay && !setCommands[this.zone]) {
                    this.log(this.name,'(Fan) *New State* - Updating Manual - ON')
                    this.ManualSwitchService.getCharacteristic(Characteristic.On).updateValue(1)
                }
            }
            this.lastState = state
        },

        setNewState: function(command, state) {
            const token = storage.getItem('Tado_Token')
            if (!setCommands[this.zone])
                setCommands[this.zone] = {
                    commands: {},
                    processing: false
                }
            setCommands[this.zone].commands[command] = state

            if (!setCommands[this.zone].processing) {
                setCommands[this.zone].processing = true

                setTimeout(() => {
                    const commands = setCommands[this.zone].commands
                    let overlayMode = storage.getItem(this.name).lastMode
                    let newState
                    if (commands['manualControl'] && commands['manualControl'] === 'OFF') {
                        //  Turning Off Manual Control
                        this.log('Turning OFF ' + this.zoneName + ' Manual Control')
                        tadoApi.setOverlay(this.username, this.password, this.homeId, this.zone, null, token, this.debug, () => {
                            delete setCommands[this.zone]
                        })

                        //  sending OFF command for all scenarios
                    } else if ((commands['fanPower'] === 'OFF' || commands['power'] === 'OFF' || commands['mode'] === 'OFF')
                        && (commands['fanPower'] !== 'ON' && commands['power'] !== 'ON' && (commands['mode'] === 'OFF' || !commands['mode']))) {

                        this.log('Turning OFF ' + this.zoneName + ' AC')
                        tadoApi.setOverlay(this.username, this.password, this.homeId, this.zone, this.offOverlay, token, this.debug, () => {
                            // comparing with old state and updating Characteristics
                            newState = {
                                setting: { type: 'AIR_CONDITIONING', power: 'OFF' },
                                overlay: { 
                                    type: this.tadoMode,
                                    setting: { 
                                        type: 'AIR_CONDITIONING', power: 'OFF' 
                                    },
                                },
                                sensorDataPoints: this.lastState.sensorDataPoints
                            }
                            delete setCommands[this.zone]
                            this.updateAccessoryState(newState, this.lastState)
                        })
                    } else {
                        if (commands['manualControl'] && commands['manualControl'] === 'ON')
                            this.log('Turning ON ' + this.zoneName + ' Manual Control')

                        if (commands['fanPower'] && commands['fanPower'] === 'ON')
                            overlayMode = 'FAN'

                        if (commands['fanSwing'] && this.capabilities['FAN'].swings) {
                            this.lastOverlay['FAN'].setting.swing = commands['fanSwing']
                            overlayMode = 'FAN'
                        }

                        if (commands['fanFanspeed'] && this.capabilities['FAN'].fanSpeeds && this.capabilities['FAN'].fanSpeeds.includes(commands['fanFanspeed'])) {
                            this.lastOverlay['FAN'].setting.fanSpeed = commands['fanFanspeed']
                            overlayMode = 'FAN'
                        }

                        // switching mode when received
                        if (commands['mode'] && commands['mode'] !== 'OFF') {
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
                        
                        if (commands['fanspeed'] && this.capabilities[overlayMode].fanSpeeds && this.capabilities[overlayMode].fanSpeeds.includes(commands['fanspeed']))
                            this.lastOverlay[overlayMode].setting.fanSpeed = commands['fanspeed']

                        this.log('Setting new state on ' + this.zoneName + ' -->')
                        this.log(this.lastOverlay[overlayMode])

                        tadoApi.setOverlay(this.username, this.password, this.homeId, this.zone, this.lastOverlay[overlayMode], token, this.debug, () => {
                            
    
                            // comparing with old state and updating Characteristics
                            
                            newState = {
                                setting: this.lastOverlay[overlayMode].setting,
                                overlay: this.lastOverlay[overlayMode].setting,
                                sensorDataPoints: this.lastState.sensorDataPoints
                            }
                            
                            delete setCommands[this.zone]
                            this.updateAccessoryState(newState, this.lastState)
                        })
                    }


                }, 200)
            }
        },

        getWeatherState: function(callback, isPollCall) {

            // check if it's polling request or if polling is enabled
            if (this.polling && !isPollCall) {
                callback(this.lastState)
            }

            if (!weatherCallbacks.callbacks || !weatherCallbacks.callbacks.length)
                weatherCallbacks = {
                    callbacks: [callback],
                    processing: false
                }
            else
                weatherCallbacks.callbacks.push(callback)

            if (!weatherCallbacks.processing) {
                weatherCallbacks.processing = true

                if (this.debug) this.log('Getting Weather Sensors State')

                const self = this
                tadoApi.getWeather(this.username, this.password, this.homeId, (err, state) => {
                    if (err) {
                        self.log('XXX - Error Getting Weather - XXX')
                        if (self.debug) self.log('Sending', weatherCallbacks.callbacks.length, 'lastState callbacks to', self.name)
                        weatherCallbacks.callbacks.forEach(callback => {
                            callback(self.lastState)
                        })
                        weatherCallbacks.processing = false
                        weatherCallbacks.callbacks = []
                    } else {

                        const solar = state.solarIntensity.percentage
                        const outsideTemperature = self.useFahrenheit ? state.outsideTemperature.fahrenheit : state.outsideTemperature.celsius
                        
                        if (self.debug) self.log(state)
                        if (!isPollCall || self.debug) {
                            self.log('Solar Intensity is ' + solar + '%')
                            self.log('Outside Temperature is ' + outsideTemperature + 'º', self.useFahrenheit ? "F" : "C")
                        }

                        self.lastState = {
                            solar: solar,
                            temp: outsideTemperature
                        }

                        if (isPollCall || self.polling){
                            if (self.debug && !isPollCall) self.log('Callbacks already sent updating Characteristic for ', self.name)
                            self.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(self.lastState.temp)
                            self.SolarSensor.getCharacteristic(Characteristic.Brightness).updateValue(self.lastState.solar)
                            self.SolarSensor.getCharacteristic(Characteristic.On).updateValue(!!self.lastState.solar)
                        } else {
                            if (self.debug) self.log('Sending', weatherCallbacks.callbacks.length, 'callbacks to', self.name)
                            weatherCallbacks.callbacks.forEach(callback => {
                                callback(self.lastState)
                            })
                        }
                        weatherCallbacks.processing = false
                        weatherCallbacks.callbacks = []

                    }
                })
            }
        },

        checkOccupancy: function() {

            if (this.name === 'Anyone') {
                const anyoneOccupied = this.platform.occupancySensors.find(sensor => sensor.occupied) 
                if (anyoneOccupied) {
                    if (!this.occupied) {
                        this.occupied = 1
                        this.log('Someone is at Home!')
                        this.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(1)
                    }
                } else {
                    if (this.occupied) {
                        this.occupied = 0
                        this.log('No One is at Home!')
                        this.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(0)
                    }
                }
                if (this.debug) self.log('Anyone Sensor- State - ', this.occupied)
            } else {
                const self = this
                tadoApi.getMobileDevices(this.username, this.password, this.homeId, (err, state) => {
                    if (err) {
                        self.log('XXX - Error Getting Occupancy Status for ' + self.name + ' - Not Doing Anything! - XXX')
                    } else {
                        const device = state.find(mobile => mobile.id == self.deviceId)
                        if (device.location !== null && device.location.atHome) {
                            if (!self.occupied) {
                                self.occupied = 1
                                self.log(self.name + ' is at Home!')
                                self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(1)
                            }
                        } else {
                            if (self.occupied) {
                                self.occupied = 0
                                self.log(self.name + ' is Out!')
                                self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(0)
                            }
                        }
                        if (self.debug) self.log(self.name, '- State - ', self.occupied)
                    }
                })
            }
        }
    }
    return tadoHelpers
}