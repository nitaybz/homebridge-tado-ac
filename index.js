var Service, Characteristic;
var async = require("async"),
    https = require('https');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;
    HomebridgeAPI = homebridge;
    homebridge.registerPlatform('homebridge-tado-ac', 'TadoAC', TadoACplatform);
}

function TadoACplatform(log, config, api) {
    this.log = log;
    this.config = config;
    this.name = config['name'] || "Tado AC";
    this.username = config['username'];
    this.password = encodeURIComponent(config['password']);
    this.token = "";
    this.homeID = "";
    this.temperatureUnit = ""
    this.tadoMode = config['tadoMode'] || "MANUAL";
    this.weatherSensorsEnabled = config['weatherSensorsEnabled'] || false;
    this.weatherPollingInterval = (config['weatherPollingInterval']*60*1000) || false;
    this.occupancySensorsEnabled = config['occupancySensorsEnabled'] || false;
    this.occupancyPollingInterval = (config['occupancyPollingInterval']*1000) || 10000;
    this.anyoneSensor = (config['anyoneSensor']) || true;
}

TadoACplatform.prototype = {
    accessories: function(callback) {

        var myAccessories = []
        var self = this;
        async.waterfall([
            // get homeID
            function(next){
                var options = {
                    host: 'my.tado.com',
                    path: '/api/v2/me?password=' + self.password + '&username=' + self.username,
                    method: 'GET'
                };

                https.request(options, function(response){
                    var strData = '';
                    response.on('data', function(chunk) {
                        strData += chunk;
                    });
                    response.on('end', function() {
                        try {
                            var data = JSON.parse(strData);
                            self.homeID = data.homes[0].id;
                            //self.log("Home ID is: " + self.homeID)
                        }
                        catch(e){
                            self.log("Could not retrieve Home ID, error:" + e);
                        }
                        next()
                    });
                }).end();
            },

            // get temperatureUnit
            function(next){
                var options = {
                    host: 'my.tado.com',
                    path: '/api/v2/homes/' + self.homeID + '?password=' + self.password + '&username=' + self.username,
                    method: 'GET'
                };

                https.request(options, function(response){
                    var strData = '';
                    response.on('data', function(chunk) {
                        strData += chunk;
                    });
                    response.on('end', function() {
                        try {
                            var data = JSON.parse(strData);
                            self.temperatureUnit = data.temperatureUnit;
                            //self.log("Temperature Unit is: " + self.temperatureUnit)
                        }
                        catch(e){
                            self.log("Could not retrieve Temperature Unit, error:" + e);
                        }
                        next()
                    });
                }).end();
            },

            // get Zones
            function(next){
                var options = {
                    host: 'my.tado.com',
                    path: '/api/v2/homes/' + self.homeID + '/zones?password=' + self.password + '&username=' + self.username,
                    method: 'GET'
                };

                https.request(options, function(response){
                    var strData = '';
                    response.on('data', function(chunk) {
                        strData += chunk;
                    });
                    response.on('end', function() {
                        try {
                            var zones = JSON.parse(strData);
                            var zonesArray = []
                            for (i=0;i<zones.length;i++){
                                if (zones[i].type == "AIR_CONDITIONING"){
                                    var tadoConfig = {
                                        id: zones[i].id,
                                        name: zones[i].name,
                                        homeID: self.homeID,
                                        username: self.username,
                                        password: self.password,
                                        temperatureUnit: self.temperatureUnit,
                                        tadoMode: self.tadoMode
                                    }
                                    self.log("Found new Zone: "+ tadoConfig.name + " (" + tadoConfig.id + ") ...")
                                    zonesArray.push(tadoConfig);
                                }
                            }
                            
                        }
                        catch(e){
                            self.log("Could not retrieve Zones, error:" + e);
                        }
                        next(null, zonesArray)
                    });
                }).end();
            },

            //get Capabilities
            function(zonesArray, next){
                async.forEachOf(zonesArray, function (zone, key, step) {

                    zone.autoMode = false;
                    zone.coolMode = false;
                    zone.heatMode = false;
                    zone.fanMode = false;
                    zone.maxSpeed = 0;
                    zone.useSwing = false;
                    zone.useFanSpeed = false;
                    zone.autoFanExists = false

                    var options = {
                        host: 'my.tado.com',
                        path: '/api/v2/homes/' + zone.homeID + '/zones/' + zone.id + '/capabilities?password=' + zone.password + '&username=' + zone.username,
                        method: 'GET'
                    };
                
                    https.request(options, function(response){
                        var strData = '';
                        response.on('data', function(chunk) {
                            strData += chunk;
                        });
                        response.on('end', function() {
                            try {
                                var capabilities = JSON.parse(strData);
                                //self.log(JSON.stringify(capabilities))
                                if (capabilities['AUTO']){
                                    zone.autoMode = {};
                                    if (capabilities['AUTO']['fanSpeeds']){
                                        zone.useFanSpeed = true;
                                        zone.autoMode.fanSpeeds = capabilities['AUTO']['fanSpeeds']
                                        for (i=0;i<zone.autoMode.fanSpeeds.length;i++){
                                            if (zone.autoMode.fanSpeeds[i] == "AUTO"){
                                                zone.autoFanExists = true
                                            }
                                        }
                                        if (capabilities['AUTO']['fanSpeeds'].length > zone.maxSpeed){
                                            zone.maxSpeed = capabilities['AUTO']['fanSpeeds'].length;
                                        }
                                    }
                                    if (capabilities['AUTO']['swings']){
                                        zone.autoMode.swings = true;
                                        zone.useSwing = true;
                                    }
                                }
                                if (capabilities['FAN']){
                                    zone.fanMode = {};
                                    if (capabilities['FAN']['fanSpeeds']){
                                        zone.useFanSpeed = true;
                                        zone.fanMode.fanSpeeds = capabilities['FAN']['fanSpeeds']
                                        for (i=0;i<zone.fanMode.fanSpeeds.length;i++){
                                            if (zone.fanMode.fanSpeeds[i] == "AUTO"){
                                                zone.autoFanExists = true
                                            }
                                        }
                                        if (capabilities['FAN']['fanSpeeds'].length > zone.maxSpeed){
                                            zone.maxSpeed = capabilities['FAN']['fanSpeeds'].length;
                                        }
                                    }
                                    if (capabilities['FAN']['swings']){
                                        zone.fanMode.swings = true;
                                        zone.useSwing = true;
                                    }
                                }
                                if (capabilities['HEAT']){
                                    zone.heatMode = {};
                                    zone.heatMode.minValue = capabilities['HEAT']['temperatures']['celsius']['min'];
                                    zone.heatMode.maxValue = capabilities['HEAT']['temperatures']['celsius']['max'];
                                    if (capabilities['HEAT']['fanSpeeds']){
                                        zone.useFanSpeed = true;
                                        zone.heatMode.fanSpeeds = capabilities['HEAT']['fanSpeeds']
                                        for (i=0;i<zone.heatMode.fanSpeeds.length;i++){
                                            if (zone.heatMode.fanSpeeds[i] == "AUTO"){
                                                zone.autoFanExists = true
                                            }
                                        }
                                        if (capabilities['HEAT']['fanSpeeds'].length > zone.maxSpeed){
                                            zone.maxSpeed = capabilities['HEAT']['fanSpeeds'].length;
                                        }
                                    }
                                    if (capabilities['HEAT']['swings']){
                                        zone.heatMode.swings = true;
                                        zone.useSwing = true;
                                    }
                                }
                                if (capabilities['COOL']){
                                    zone.coolMode = {};
                                    zone.coolMode.minValue = capabilities['COOL']['temperatures']['celsius']['min'];
                                    zone.coolMode.maxValue = capabilities['COOL']['temperatures']['celsius']['max'];
                                    if (capabilities['COOL']['fanSpeeds']){
                                        zone.useFanSpeed = true;
                                        zone.coolMode.fanSpeeds = capabilities['COOL']['fanSpeeds']
                                        for (i=0;i<zone.coolMode.fanSpeeds.length;i++){
                                            if (zone.coolMode.fanSpeeds[i] == "AUTO"){
                                                zone.autoFanExists = true
                                            }
                                        }
                                        if (capabilities['COOL']['fanSpeeds'].length > zone.maxSpeed){
                                            zone.maxSpeed = capabilities['COOL']['fanSpeeds'].length;
                                        }
                                    }
                                    if (capabilities['COOL']['swings']){
                                        zone.coolMode.swings = true;
                                        zone.useSwing = true;
                                    }
                                }
                            }
                            catch(e){
                                self.log("Could not retrieve Zone Capabilities, error:" + e);
                            }
                            var tadoAccessory = new TadoAccessory(self.log, zone)
                            myAccessories.push(tadoAccessory);

                            step()
                        });
                    }).end();
                }, function(err){
                    next()
                })
            },

            // set Outside Temperature Sensor
            function (next){
                if (self.weatherSensorsEnabled){
                    var weatherConfig = {
                        homeID: self.homeID,
                        username: self.username,
                        password: self.password,
                        temperatureUnit: self.temperatureUnit,
                        polling: self.weatherPollingInterval
                    }
                    var TadoWeatherAccessory = new TadoWeather(self.log, weatherConfig)
                    myAccessories.push(TadoWeatherAccessory);
                }
                next();
            },

            // set occupancy sensors
            function (next){
                if (self.occupancySensorsEnabled){
                    self.occupancySensors = [];
                    var addUser = function(id, name, device){
                        var occupancyConfig = {
                            homeID: self.homeID,
                            username: self.username,
                            password: self.password,
                            deviceId: id,
                            name: name,
                            device: device,
                            polling: self.occupancyPollingInterval
                        }
                        var TadoOccupancySensor = new occupancySensor(self.log, occupancyConfig, self)
                        myAccessories.push(TadoOccupancySensor);
                        if (name !== "Anyone") self.occupancySensors.push(TadoOccupancySensor);
                    }

                    var options = {
                        host: 'my.tado.com',
                        path: '/api/v2/homes/' + self.homeID + '/users?password=' + self.password + '&username=' + self.username,
                        method: 'GET'
                    };
    
                    https.request(options, function(response){
                        var strData = '';
                        response.on('data', function(chunk) {
                            strData += chunk;
                        });
                        response.on('end', function() {
                            try {
                                var data = JSON.parse(strData);
                                for (i=0;i<data.length;i++){
                                    var mobileID = false;
                                    var deviceData = {};
                                    for (j=data[i].mobileDevices.length-1;j>=0;j--){
                                        if (data[i].mobileDevices[j].settings.geoTrackingEnabled){
                                            mobileID = data[i].mobileDevices[j].id;
                                            deviceData = data[i].mobileDevices[j].deviceMetadata;
                                        }
                                    }
                                    if (mobileID){
                                        addUser(mobileID, data[i].name, deviceData)
                                    }
                                }
                                if (self.occupancySensors.length > 0 && self.anyoneSensor){
                                    addUser(11111, "Anyone", {platform: "anyone", osVersion: "1.1.1", model: "Tado"})
                                }
                            }
                            catch(e){
                                self.log("Could not retrieve Tado Users, error:" + e);
                            }
                            next()
                        });
                    }).end();
                } else next()
            }

        ],function(err, result){
            callback(myAccessories);
        })
    }
}




















/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************      TADO AC      ******************************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/





function TadoAccessory(log, config) {
    var accessory = this;
    this.log = log;
    this.storage = require('node-persist');
    this.zoneName = config.name;
    this.name = config.name + " Tado";
    this.homeID = config.homeID;
    this.username = config.username;
    this.password = config.password;
    this.tadoMode = config.tadoMode;
    this.zone = config.id;
    this.useFahrenheit = config.temperatureUnit == "CELSIUS" ? false : true;
    this.autoMode = config.autoMode;
    this.coolMode = config.coolMode;
    this.heatMode = config.heatMode;
    this.fanMode = config.fanMode;
    
    this.autoFanExists = config.autoFanExists
    this.maxSpeed = config.maxSpeed;
    this.useSwing = config.useSwing;
    this.useFanSpeed = config.useFanSpeed;
    this.callbacks = [];
    this.processing = false;
    this.setProcessing = false;
    this.setFunctions = [];
    this.setFanProcessing = false;
    this.setFanFunctions = [];

    this.storage.initSync({
        dir: HomebridgeAPI.user.persistPath()
    });

    this.coolMidValue = this.coolMode.maxValue - (this.coolMode.maxValue-this.coolMode.minValue)/2;
    var lastCoolOverlay = {
        "termination": {
            "type": this.tadoMode
        },
        "setting": {
            "power": "ON",
            "type": "AIR_CONDITIONING",
            "mode": "COOL",
            "temperature": {
                "fahrenheit": Math.round(this.coolMidValue * 1.8 + 32),
                "celsius": this.coolMidValue
            }
        }
    };
    if (this.coolMode.fanSpeeds) { lastCoolOverlay.setting.fanSpeed = this.coolMode.fanSpeeds[1] }
    if (this.coolMode.swings) { lastCoolOverlay.setting.swing = "OFF" }

    this.heatMidValue = this.heatMode.maxValue - (this.heatMode.maxValue-this.heatMode.minValue)/2;
    var lastHeatOverlay = {
        "termination": {
            "type": this.tadoMode
        },
        "setting": {
            "power": "ON",
            "type": "AIR_CONDITIONING",
            "mode": "HEAT",
            "temperature": {
                "fahrenheit": Math.round(this.heatMidValue * 1.8 + 32),
                "celsius": this.heatMidValue
            }
        }
    };
    if (this.heatMode.fanSpeeds) { lastHeatOverlay.setting.fanSpeed = this.heatMode.fanSpeeds[1] }
    if (this.heatMode.swings) { lastHeatOverlay.setting.swing = "OFF" }


    var lastAutoOverlay = {
        "termination": {
            "type": this.tadoMode
        },
        "setting": {
            "power": "ON",
            "type": "AIR_CONDITIONING",
            "mode": "AUTO",
        }
    };
    if (this.autoMode.fanSpeeds) { lastAutoOverlay.setting.fanSpeed = this.autoMode.fanSpeeds[1] }
    if (this.autoMode.swings) { lastAutoOverlay.setting.swing = "OFF" }

    var lastFanOverlay = {
        "termination": {
            "type": this.tadoMode
        },
        "setting": {
            "power": "ON",
            "type": "AIR_CONDITIONING",
            "mode": "FAN",
        }
    };
    if (this.fanMode.fanSpeeds) { lastFanOverlay.setting.fanSpeed = this.fanMode.fanSpeeds[1] }
    if (this.fanMode.swings) { lastFanOverlay.setting.swing = "OFF" }

    this.lastMode = {
        cool: lastCoolOverlay,
        heat: lastHeatOverlay,
        auto: lastAutoOverlay,
        fan: lastFanOverlay,
        last: lastCoolOverlay
    }

    if (this.storage.getItem(this.name) == null){
        this.storage.setItem(this.name, this.lastMode);
    } else {
        this.lastMode = this.storage.getItem(this.name)
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
}

TadoAccessory.prototype.getServices = function() {
    
    var informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
        .setCharacteristic(Characteristic.Model, 'Tado Smart AC Control')
        .setCharacteristic(Characteristic.SerialNumber, 'Tado Serial Number');

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
            minValue: 0,
            maxValue: 100,
            minStep: 0.01
        })
        .on('get', this.getCurrentTemperature.bind(this));

    this.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature) 
        .setProps({
            minValue: this.coolMode.minValue,
            maxValue: this.coolMode.maxValue,
            minStep: 1
        })
        .on('get', this.getCoolingThresholdTemperature.bind(this))
        .on('set', this.setCoolingThresholdTemperature.bind(this));

    this.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature) 
        .setProps({
            minValue: this.heatMode.minValue,
            maxValue: this.heatMode.maxValue,
            minStep: 1
        })
        .on('get', this.getHeatingThresholdTemperature.bind(this))
        .on('set', this.setHeatingThresholdTemperature.bind(this));

    this.HeaterCoolerService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this));
    
    if (this.useSwing){
        this.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode)
            .on('get', this.getSwing.bind(this))
            .on('set', this.setSwing.bind(this));
    }
    
    if (this.useFanSpeed){
        if (this.autoFanExists){
            this.steps = 100 / (this.maxSpeed - 1)
        } else {
            this.steps = 100 / (this.maxSpeed)
        }
        this.steps = this.steps.toFixed(2)
        this.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed)
            .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: this.steps
                })
            .on('get', this.getRotationSpeed.bind(this))
            .on('set', this.setRotationSpeed.bind(this));
    }
    


    this.HumiditySensor = new Service.HumiditySensor(this.zoneName + " Humidity");

    this.HumiditySensor.getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .setProps({
            minValue: 0,
            maxValue: 100,
            minStep: 0.01
        })
        .on('get', this.getCurrentRelativeHumidity.bind(this));

    var services = [informationService, this.HeaterCoolerService, this.HumiditySensor];
    
    if (this.fanMode){
        this.FanService = new Service.Fanv2(this.zoneName + " Fan");
        
        this.FanService.getCharacteristic(Characteristic.Active)
            .on('get', this.getFanActive.bind(this))
            .on('set', this.setFanActive.bind(this));
        
            if (this.fanMode.swings){
                this.FanService.getCharacteristic(Characteristic.SwingMode)
                    .on('get', this.getFanSwing.bind(this))
                    .on('set', this.setFanSwing.bind(this));
            }

            

            if (this.fanMode.fanSpeeds){
                var autoFan = false
                for (i=0;i<this.fanMode.fanSpeeds.length;i++){
                    if (this.fanMode.fanSpeeds[i] == "AUTO"){
                        autoFan = true
                    }
                }
                if (autoFan){
                    this.fanSteps = 100 / (this.fanMode.fanSpeeds.length- 1)
                } else {
                    this.fanSteps = 100 / (this.fanMode.fanSpeeds.length)
                }
                this.fanSteps = this.fanSteps.toFixed(2)
                
                this.FanService.getCharacteristic(Characteristic.RotationSpeed)
                    .setProps({
                            minValue: 0,
                            maxValue: 100,
                            minStep: this.fanSteps
                        })
                    .on('get', this.getFanRotationSpeed.bind(this))
                    .on('set', this.setFanRotationSpeed.bind(this));
            }
        
        services.push(this.FanService);
    }
    

    return services;
}



/*********************************************************************************/
/***********************************  GET COMMANDS  ******************************/
/*********************************************************************************/

TadoAccessory.prototype._getCurrentStateResponse = function(callback) {
    var self = this;
    var options = {
        host: 'my.tado.com',
        path: '/api/v2/homes/' + self.homeID + '/zones/' + self.zone + '/state?username=' + self.username + '&password=' + self.password,
    };

    self.callbacks.push(callback)
    if (!self.processing) {
        // self.log("Getting status from " + self.name)
        self.processing = true;
        https.request(options, function(response){
            var strData = '';
            response.on('data', function(chunk) {
                strData += chunk;
            });
            response.on('end', function() {
                try{
                    var data = JSON.parse(strData);
                    self.processing = false;
                    if (data.setting.power !== "OFF") {
                        switch (data.setting.mode){
                            case "COOL":
                            self.lastMode.last.setting = data.setting
                            self.lastMode.cool.setting = self.lastMode.last.setting;
                                break;
                            case "HEAT":
                            self.lastMode.last.setting = data.setting
                            self.lastMode.heat.setting = self.lastMode.last.setting;
                                break;
                            case "AUTO":
                                self.lastMode.last.setting = data.setting
                                self.lastMode.auto.setting = self.lastMode.last.setting;
                                break;
                            case "FAN":
                                self.lastMode.fan.setting = data.setting;
                                break;
                        }
                        
                        self.storage.setItem(self.name, self.lastMode);
                    }

                    for (var i=0; i<self.callbacks.length; i++) {
                        self.callbacks[i](null, data);
                    }
                    
                } catch(e){
                    self.log("Could not retrieve status from " + self.zoneName + "; error: " + e)
                }
                self.callbacks = [];

            });
        }).end();
    }
}

TadoAccessory.prototype.getActive = function(callback) {
    var accessory = this;
    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power == "OFF" || data.setting.mode == "FAN") {
            callback(null, Characteristic.Active.INACTIVE);
        } else {
            callback(null, Characteristic.Active.ACTIVE);
        }
    })
}

TadoAccessory.prototype.getCurrentHeaterCoolerState = function(callback) {
    var accessory = this;
    //accessory.lastMode = accessory.storage.getItem(accessory.name);
    accessory._getCurrentStateResponse(function(err, data) {

        //accessory.log("data = " + JSON.stringify(data));

        
        if (data.setting.power == "OFF") {
            accessory.log(accessory.zoneName + " Mode is OFF");
            callback(null, Characteristic.CurrentHeaterCoolerState.INACTIVE);
        } else {
            accessory.log(accessory.zoneName + " Mode is " + data.setting.mode);
            if (data.setting.mode == "COOL") {
                callback(null, Characteristic.CurrentHeaterCoolerState.COOLING);
            } else if (data.setting.mode == "HEAT") {
                callback(null, Characteristic.CurrentHeaterCoolerState.HEATING);
            } else if (data.setting.mode == "FAN") {
                callback(null, Characteristic.CurrentHeaterCoolerState.INACTIVE);
            } else if (data.setting.mode == "AUTO") {
                callback(null, Characteristic.CurrentHeaterCoolerState.IDLE);
            }
        }

    })
}

TadoAccessory.prototype.getTargetHeaterCoolerState = function(callback) {
    var accessory = this;  
    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power == "OFF") {
            //accessory.log(accessory.zoneName + " Mode is OFF");
            callback(null, null);
        } else {
            if (data.setting.mode == "COOL") {
                callback(null, Characteristic.TargetHeaterCoolerState.COOL);
            } else if (data.setting.mode == "HEAT") {
                callback(null, Characteristic.TargetHeaterCoolerState.HEAT);
            } else if (data.setting.mode == "FAN") {
                callback(null, null);
            } else if (data.setting.mode == "AUTO") {
                callback(null, Characteristic.TargetHeaterCoolerState.AUTO);
            }
        }

    })
}

TadoAccessory.prototype.getCurrentTemperature = function(callback) {
    var accessory = this;  
    accessory._getCurrentStateResponse(function(err, data) {
        if (accessory.useFahrenheit) {
            accessory.log(accessory.zoneName + " Current Temperature is " + data.sensorDataPoints.insideTemperature.fahrenheit + "ºF");
        } else {
            accessory.log(accessory.zoneName + " Current Temperature is " + data.sensorDataPoints.insideTemperature.celsius + "ºC");
        } 
        callback(null, data.sensorDataPoints.insideTemperature.celsius);
    })
}

TadoAccessory.prototype.getCoolingThresholdTemperature = function(callback) {
    var accessory = this;  
    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power == "ON" && data.setting.mode == "COOL") {
            if (accessory.useFahrenheit) {
                accessory.log(accessory.zoneName + " Target Temperature is " + data.setting.temperature.fahrenheit + "ºF");
            } else {
                accessory.log(accessory.zoneName + " Target Temperature is " + data.setting.temperature.celsius + "ºC");
            } 
            callback(null, data.setting.temperature.celsius);
        } else if (data.setting.power == "ON" && data.setting.mode == "AUTO") {
            callback(null, accessory.coolMidValue);
        } else callback(null, null)
    })
}

TadoAccessory.prototype.getHeatingThresholdTemperature = function(callback) {
    var accessory = this;  
    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power == "ON" && data.setting.mode == "HEAT") {
            if (accessory.useFahrenheit) {
                accessory.log(accessory.zoneName + " Target Temperature is " + data.setting.temperature.fahrenheit + "ºF");
            } else {
                accessory.log(accessory.zoneName + " Target Temperature is " + data.setting.temperature.celsius + "ºC");
            }
            callback(null, data.setting.temperature.celsius);
        } else if (data.setting.power == "ON" && data.setting.mode == "AUTO") {
            callback(null, accessory.heatMidValue);
        } else callback(null, null)
    })
}

TadoAccessory.prototype.getTemperatureDisplayUnits = function(callback) {
    var accessory = this;
    //accessory.log("The current temperature display unit is " + (accessory.useFahrenheit ? "ºF" : "ºC"));
    callback(null, accessory.useFahrenheit ? Characteristic.TemperatureDisplayUnits.FAHRENHEIT : Characteristic.TemperatureDisplayUnits.CELSIUS);
}


TadoAccessory.prototype.getSwing = function(callback) {
    var accessory = this;  
    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power == "ON" && (
               (data.setting.mode == "HEAT" && accessory.heatMode.swings)
            || (data.setting.mode == "COOL" && accessory.coolMode.swings)
            || (data.setting.mode == "AUTO" && accessory.autoMode.swings)
            
        )) {
            callback(null, data.setting.swing == "ON" ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED);
        } else callback(null, null)
        
    })
}

TadoAccessory.prototype.getRotationSpeed = function(callback) {
    var accessory = this;  

    var returnfanSpeedValue = function(speedsArray, fanSpeed){
        switch (fanSpeed){
            case "AUTO":
                return (accessory.steps*2);
                break;
            case "HIGH":
                return 100;
                break;
            case "MIDDLE":
                return (accessory.steps*2);
                break;
            case "LOW":
                return accessory.steps;
                break;
        }
    }

    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power == "ON"){
            if (data.setting.mode == "HEAT" && accessory.heatMode.fanSpeeds){
                callback(null, returnfanSpeedValue(accessory.heatMode.fanSpeeds, data.setting.fanSpeed))
            } else if (data.setting.mode == "COOL" && accessory.coolMode.fanSpeeds){
                callback(null, returnfanSpeedValue(accessory.coolMode.fanSpeeds, data.setting.fanSpeed))
            } else if (data.setting.mode == "AUTO" && accessory.autoMode.fanSpeeds){
                callback(null, returnfanSpeedValue(accessory.autoMode.fanSpeeds, data.setting.fanSpeed))
            } else callback(null, null)
        } else callback(null, null)
        
    })
}

TadoAccessory.prototype.getCurrentRelativeHumidity = function(callback) {
    var accessory = this;  
    accessory._getCurrentStateResponse(function(err, data) {
            accessory.log(accessory.zoneName + " Humidity is " + data.sensorDataPoints.humidity.percentage + "%");
            callback(null, data.sensorDataPoints.humidity.percentage);
    })
}

TadoAccessory.prototype.getFanActive = function(callback) {
    var accessory = this;
    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power !== "OFF" && data.setting.mode == "FAN") {
            callback(null, Characteristic.Active.ACTIVE);
        } else {
            callback(null, Characteristic.Active.INACTIVE);
        }
    })
}

TadoAccessory.prototype.getFanSwing = function(callback) {
    var accessory = this;  
    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power == "ON" && data.setting.mode == "FAN" && accessory.fanMode.swings) {
            callback(null, data.setting.swing == "ON" ? Characteristic.SwingMode.SWING_ENABLED : Characteristic.SwingMode.SWING_DISABLED);
        } else callback(null, null)
        
    })
}

TadoAccessory.prototype.getFanRotationSpeed = function(callback) {
    var accessory = this;  

    var returnfanSpeedValue = function(speedsArray, fanSpeed){
        switch (fanSpeed){
            case "AUTO":
                return (accessory.fanSteps*2);
                break;
            case "HIGH":
                return 100;
                break;
            case "MIDDLE":
                return (accessory.fanSteps*2);
                break;
            case "LOW":
                return accessory.fanSteps;
                break;
        }
    }

    accessory._getCurrentStateResponse(function(err, data) {
        if (data.setting.power == "ON" && data.setting.mode == "FAN" && accessory.fanMode.fanSpeeds){
            callback(null, returnfanSpeedValue(accessory.fanMode.fanSpeeds, data.setting.fanSpeed))
        } else callback(null, null)
    })
}










/*********************************************************************************/
/***********************************  SET COMMANDS  ******************************/
/*********************************************************************************/

TadoAccessory.prototype._setOverlay = function(overlay, functionName, state) {
    var accessory = this;
    var overlayReady = {}
    var turnOff = false;
    //accessory.log("Setting new overlay");
    var checkIfModeExists = function(fanSpeedsArray, speed){
        for(l=0;l<fanSpeedsArray.length;l++){
            if (fanSpeedsArray[l] == speed){
                return true
            }
        } return false
    }

    accessory.setFunctions.push({"overlay": overlay, "name": functionName, "state": state})
    if (!accessory.setProcessing) {
        //self.log("Getting status from " + self.zoneName)
        accessory.setProcessing = true;
        setTimeout(function(){
            if (accessory.setFunctions.length == 1){
                if (accessory.setFunctions[0].overlay !== null && accessory.setFunctions[0].overlay.setting.power !== "OFF"){
                    accessory.lastMode.last = accessory.setFunctions[0].overlay
                    if (accessory.setFunctions[0].name == "active"){
                        accessory.log("Activating " + accessory.zoneName + " AC")
                    }
                    
                } else turnOff = true
            } else {
                for (j=0;j<accessory.setFunctions.length;j++){
                    if (accessory.setFunctions[j].overlay !== null){
                        switch (accessory.setFunctions[j].name){
                            case "active":
                                if (accessory.setFunctions[j].overlay.setting.power == "OFF"){
                                    turnOff = true
                                }
                                break;
                            case "mode":
                            accessory.lastMode.last = accessory.setFunctions[j].overlay
                                
                                break;
                        }
                    }
                }
                for (i=0;i<accessory.setFunctions.length;i++){
                    if (accessory.setFunctions[i].overlay !== null){
                        switch (accessory.setFunctions[i].name){
                            case "coolTemp":
                                if (accessory.lastMode.last.setting.mode == "COOL"){
                                    if (accessory.useFahrenheit){
                                        accessory.lastMode.cool.setting.temperature.fahrenheit = Math.round(accessory.setFunctions[i].state*9/5+32)
                                        accessory.lastMode.last.setting.temperature.fahrenheit = Math.round(accessory.setFunctions[i].state*9/5+32)
                                    } else {
                                        accessory.lastMode.cool.setting.temperature.celsius = accessory.setFunctions[i].state
                                        accessory.lastMode.last.setting.temperature.celsius = accessory.setFunctions[i].state
                                    }
                                }
                                break;
                            case "heatTemp":
                                if (accessory.lastMode.last.setting.mode == "HEAT"){
                                    accessory.lastMode.heat.setting.temperature.fahrenheit = Math.round(accessory.setFunctions[i].state*9/5+32)
                                    accessory.lastMode.last.setting.temperature.fahrenheit = Math.round(accessory.setFunctions[i].state*9/5+32)
                                    accessory.lastMode.heat.setting.temperature.celsius = accessory.setFunctions[i].state
                                    accessory.lastMode.last.setting.temperature.celsius = accessory.setFunctions[i].state
                                }
                                break;
                            case "swing":
                                if ((accessory.lastMode.last.setting.mode == "HEAT" && accessory.heatMode.swings)
                                || (accessory.lastMode.last.setting.mode == "COOL" && accessory.coolMode.swings)
                                || (accessory.lastMode.last.setting.mode == "AUTO" && accessory.autoMode.swings)){
                                    accessory.lastMode.last.setting.swing = accessory.setFunctions[i].state
                                }
                                break;
                            case "rotationSpeed":
                                if ((accessory.lastMode.last.setting.mode == "HEAT" && accessory.heatMode.fanSpeeds && checkIfModeExists(accessory.heatMode.fanSpeeds, state))
                                || (accessory.lastMode.last.setting.mode == "COOL" && accessory.coolMode.fanSpeeds && checkIfModeExists(accessory.coolMode.fanSpeeds, state))
                                || (accessory.lastMode.last.setting.mode == "AUTO" && accessory.autoMode.fanSpeeds && checkIfModeExists(accessory.autoMode.fanSpeeds, state))){
                                    accessory.lastMode.last.setting.fanSpeed = accessory.setFunctions[i].state
                                }
                                break;
                        }
                    }
                    
                }
            }
            overlayReady = accessory.lastMode.last
            accessory.storage.setItem(accessory.name, accessory.lastMode)

            if (turnOff) {
                accessory.log("Turning OFF " + accessory.zoneName + " AC")
                accessory.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.INACTIVE);
                accessory.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE);
                if (accessory.fanMode){accessory.FanService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE)}
                overlayReady = accessory.offOverlay;
            } else {
                if (accessory.fanMode){accessory.FanService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE)}
                accessory.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.ACTIVE);
                
                switch (overlayReady.setting.mode){
                    case "COOL":
                        accessory.lastMode.cool = accessory.lastMode.last
                        accessory.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.COOL);
                        accessory.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.COOLING);
                        if (accessory.useFahrenheit){
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(Math.round((overlayReady.setting.temperature.fahrenheit - 32) * 5 / 9));
                        } else {
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(overlayReady.setting.temperature.celsius);
                        }
                        if (overlayReady.setting.swing){
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode).updateValue(overlayReady.setting.swing == "OFF" ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED);
                        }
                        if (overlayReady.setting.fanSpeed){
                            var setSpeed;
                            switch (overlayReady.setting.fanSpeed){
                                case "AUTO":
                                    setSpeed = accessory.steps*2;
                                    break;
                                case "HIGH":
                                    setSpeed = 100;
                                    break;
                                case "MIDDLE":
                                    setSpeed = accessory.steps*2;
                                    break;
                                case "LOW":
                                    setSpeed = accessory.steps;
                                    break;
                            }
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(setSpeed);
                        }
                        
                        break;
                    case "HEAT":
                        accessory.lastMode.heat = accessory.lastMode.last
                        accessory.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.HEAT);
                        accessory.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.HEATING);
                        if (accessory.useFahrenheit){
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(overlayReady.setting.temperature.fahrenheit);
                        } else {
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(overlayReady.setting.temperature.celsius);
                        }
                        if (overlayReady.setting.swing){
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode).updateValue(overlayReady.setting.swing == "OFF" ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED);
                        }
                        if (overlayReady.setting.fanSpeed){
                            var setSpeed;
                            switch (overlayReady.setting.fanSpeed){
                                case "AUTO":
                                    setSpeed = accessory.steps*2;
                                    break;
                                case "HIGH":
                                    setSpeed = 100;
                                    break;
                                case "MIDDLE":
                                    setSpeed = accessory.steps*2;
                                    break;
                                case "LOW":
                                    setSpeed = accessory.steps;
                                    break;
                            }
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(setSpeed);
                        }
                        break;
                    case "AUTO":
                        accessory.lastMode.auto = accessory.lastMode.last
                        accessory.HeaterCoolerService.getCharacteristic(Characteristic.TargetHeaterCoolerState).updateValue(Characteristic.TargetHeaterCoolerState.AUTO);
                        accessory.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.IDLE);
                        accessory.HeaterCoolerService.getCharacteristic(Characteristic.CoolingThresholdTemperature).updateValue(accessory.coolMidValue);
                        accessory.HeaterCoolerService.getCharacteristic(Characteristic.HeatingThresholdTemperature).updateValue(accessory.heatMidValue);
                        if (overlayReady.setting.swing){
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.SwingMode).updateValue(overlayReady.setting.swing == "OFF" ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED);
                        }
                        if (overlayReady.setting.fanSpeed){
                            var setSpeed;
                            switch (overlayReady.setting.fanSpeed){
                                case "AUTO":
                                    setSpeed = accessory.steps*2;
                                    break;
                                case "HIGH":
                                    setSpeed = 100;
                                    break;
                                case "MIDDLE":
                                    setSpeed = accessory.steps*2;
                                    break;
                                case "LOW":
                                    setSpeed = accessory.steps;
                                    break;
                            }
                            accessory.HeaterCoolerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(setSpeed);
                        }
                        
                        break;
                        
                }
            }

            var options = {
                host: 'my.tado.com',
                path: '/api/v2/homes/' + accessory.homeID + '/zones/' + accessory.zone + '/overlay?username=' + accessory.username + '&password=' + accessory.password,
                method: overlayReady == null ? 'DELETE' : 'PUT',
            }
            if (overlayReady != null) {
                overlayReady = JSON.stringify(overlayReady);
                //accessory.log("zone: " + accessory.zone + ",  body: " + overlayReady);
            }
            https.request(options, null).end(overlayReady);  
            accessory.setProcessing = false;
            accessory.setFunctions = []

            

        }, 500)
    }

    
}

TadoAccessory.prototype.setActive = function(state, callback) {
    var accessory = this;

    var activeFunction = function(state){
        if (state == Characteristic.Active.ACTIVE){
            return accessory.lastMode.last
        } else {
            return accessory.offOverlay
        }
    }
    accessory._setOverlay(activeFunction(state), "active", state)
    
    callback()
}

TadoAccessory.prototype.setTargetHeaterCoolerState = function(state, callback) {
    var accessory = this; 

    var modeFunction = function(state){
        switch (state){
            case Characteristic.TargetHeaterCoolerState.COOL:
                if (accessory.coolMode){
                    accessory.log("Setting " + accessory.zoneName + " AC to COOL")
                    return accessory.lastMode.cool
                } else return null
                break;
            case Characteristic.TargetHeaterCoolerState.HEAT:
                if (accessory.heatMode){
                    accessory.log("Setting " + accessory.zoneName + " AC to HEAT")
                    return accessory.lastMode.heat
                } else return null
                break;
            case Characteristic.TargetHeaterCoolerState.AUTO:
                if (accessory.autoMode){
                    accessory.log("Setting " + accessory.zoneName + " AC to AUTO")
                    return accessory.lastMode.auto
                } else return null
                break;
        }
    }
    accessory._setOverlay(modeFunction(state), "mode", state)
    
    callback()
}

TadoAccessory.prototype.setCoolingThresholdTemperature = function(temp, callback) {
    
    if (this.lastMode.last.setting.mode == "COOL"){
        this.lastMode.cool.setting.temperature.fahrenheit = Math.round(temp*9/5+32)
        this.lastMode.last.setting.temperature.fahrenheit = Math.round(temp*9/5+32)
        this.lastMode.cool.setting.temperature.celsius = temp
        this.lastMode.last.setting.temperature.celsius = temp
        if (this.useFahrenheit){
            this.log("Setting " + this.zoneName + " AC Target Temperature to " + Math.round(temp*9/5+32))
        } else {
            this.log("Setting " + this.zoneName + " AC Target Temperature to " + temp)
        }
        
        this._setOverlay(this.lastMode.last, "coolTemp", temp)
    } else {
        this._setOverlay(null, "coolTemp", temp)
    }
    
    callback()
}

TadoAccessory.prototype.setHeatingThresholdTemperature = function(temp, callback) {
    
    if (this.lastMode.last.setting.mode == "HEAT"){
        this.lastMode.heat.setting.temperature.fahrenheit = Math.round(temp*9/5+32)
        this.lastMode.last.setting.temperature.fahrenheit = Math.round(temp*9/5+32)
        this.lastMode.heat.setting.temperature.celsius = temp
        this.lastMode.last.setting.temperature.celsius = temp
        if (this.useFahrenheit){
            this.log("Setting " + this.zoneName + " AC Target Temperature to " + Math.round(temp*9/5+32))
        } else {
            this.log("Setting " + this.zoneName + " AC Target Temperature to " + temp)
        }
        
        this._setOverlay(this.lastMode.last, "heatTemp", temp)
    } else {
        this._setOverlay(null, "heatTemp", temp)
    }
    
    callback()
}

TadoAccessory.prototype.setSwing = function(state, callback) {
    state = state == Characteristic.SwingMode.SWING_ENABLED ? "ON" : "OFF"
    if ((this.lastMode.last.setting.mode == "HEAT" && this.heatMode.swings)
    || (this.lastMode.last.setting.mode == "COOL" && this.coolMode.swings)
    || (this.lastMode.last.setting.mode == "AUTO" && this.autoMode.swings)){
        this.lastMode.last.setting.swing = state
        this._setOverlay(this.lastMode.last, "swing", state)
        this.log("Setting " + this.zoneName + " AC Swing to " + state)
    } else {
        this._setOverlay(null, "swing", state)
    }
    callback()
}

TadoAccessory.prototype.setRotationSpeed = function(speed, callback) { 
    var state;
    switch (Math.round(speed)){
        case 100:
            state = "HIGH";
            break;
        case Math.round(this.steps*2):
            state = "MIDDLE";
            break;
        case Math.round(this.steps):
            state = "LOW";
            break;
    }

    var checkIfModeExists = function(fanSpeedsArray){
        for(i=0;i<fanSpeedsArray.length;i++){
            if (fanSpeedsArray[i] == state){
                return true
            }
        } return false
    }

    if ((this.lastMode.last.setting.mode == "HEAT" && this.heatMode.fanSpeeds && checkIfModeExists(this.heatMode.fanSpeeds))
    || (this.lastMode.last.setting.mode == "COOL" && this.coolMode.fanSpeeds && checkIfModeExists(this.coolMode.fanSpeeds))
    || (this.lastMode.last.setting.mode == "AUTO" && this.autoMode.fanSpeeds && checkIfModeExists(this.autoMode.fanSpeeds))){
        this.lastMode.last.setting.fanSpeed = state
        this.log("Setting " + this.zoneName + " AC Rotation Speed to " + state)
        this._setOverlay(this.lastMode.last, "rotationSpeed", state)
    } else {
        this._setOverlay(null, "rotationSpeed", state)
    }
    callback()
}






TadoAccessory.prototype._setFanOverlay = function(overlay, functionName, state) {
    var accessory = this;
    var overlayReady = {}
    var turnOff = false;

    accessory.setFanFunctions.push({"overlay": overlay, "name": functionName, "state": state})
    if (!accessory.setFanProcessing) {
        //self.log("Getting status from " + self.zoneName)
        accessory.setFanProcessing = true;
        setTimeout(function(){
            if (accessory.setFanFunctions.length == 1){
                if (accessory.setFanFunctions[0].overlay.setting.power !== "OFF"){
                    if (accessory.setFanFunctions[0].name == "fanActive"){
                        accessory.log("Activating " + accessory.zoneName + " Fan")
                    }
                    
                } else turnOff = true
            } else {
                for (i=0;i<accessory.setFanFunctions.length;i++){
                    switch (accessory.setFanFunctions[i].name){
                        case "fanActive":
                            if (accessory.setFanFunctions[i].overlay.setting.power == "OFF"){
                                turnOff = true;
                            }
                            break;
                        case "fanSwing":
                            accessory.lastMode.fan.setting.swing = accessory.setFanFunctions[i].state
                            break;
                        case "fanRotationSpeed":
                            accessory.lastMode.fan.setting.fanSpeed = accessory.setFanFunctions[i].state
                            break;
                    }
                }
            }
            overlayReady = accessory.lastMode.fan
            accessory.storage.setItem(accessory.name, accessory.lastMode)

            if (turnOff) {
                accessory.log("Turning OFF " + accessory.zoneName + " Fan")
                overlayReady = accessory.offOverlay;
                accessory.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.INACTIVE);
                accessory.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE);
                accessory.FanService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE);
            } else {
                accessory.FanService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.ACTIVE);
                accessory.HeaterCoolerService.getCharacteristic(Characteristic.CurrentHeaterCoolerState).updateValue(Characteristic.CurrentHeaterCoolerState.INACTIVE);
                accessory.HeaterCoolerService.getCharacteristic(Characteristic.Active).updateValue(Characteristic.Active.INACTIVE);
                if (overlayReady.setting.swing){
                    
                    accessory.FanService.getCharacteristic(Characteristic.SwingMode).updateValue(overlayReady.setting.swing == "OFF" ? Characteristic.SwingMode.SWING_DISABLED : Characteristic.SwingMode.SWING_ENABLED);
                }
                if (overlayReady.setting.fanSpeed){
                    var setSpeed;
                    switch (overlayReady.setting.fanSpeed){
                        case "AUTO":
                            setSpeed = accessory.fanSteps*2;
                            break;
                        case "HIGH":
                            setSpeed = 100;
                            break;
                        case "MIDDLE":
                            setSpeed = accessory.fanSteps*2;
                            break;
                        case "LOW":
                            setSpeed = accessory.fanSteps;
                            break;
                    }
                    accessory.FanService.getCharacteristic(Characteristic.RotationSpeed).updateValue(setSpeed);
                }
            }

            var options = {
                host: 'my.tado.com',
                path: '/api/v2/homes/' + accessory.homeID + '/zones/' + accessory.zone + '/overlay?username=' + accessory.username + '&password=' + accessory.password,
                method: overlayReady == null ? 'DELETE' : 'PUT',
            }
            if (overlayReady != null) {
                overlayReady = JSON.stringify(overlayReady);
                // accessory.log("zone: " + accessory.zone + ",  body: " + overlayReady);
            }
            https.request(options, null).end(overlayReady);  
            accessory.setFanProcessing = false;
            accessory.setFanFunctions = []
        }, 500)
    }

    
}


TadoAccessory.prototype.setFanActive = function(state, callback) {
    var accessory = this;
    var activeFunction = function(state){
        if (state == Characteristic.Active.ACTIVE){
            return accessory.lastMode.fan
        } else {
            return accessory.offOverlay
        }
    }
    accessory._setFanOverlay(activeFunction(state), "fanActive", state)
    callback()
}

TadoAccessory.prototype.setFanSwing = function(state, callback) {
    state = state == Characteristic.SwingMode.SWING_ENABLED ? "ON" : "OFF"
    this.lastMode.fan.setting.swing = state
    this.log("Setting " + this.zoneName + " Fan Swing to " + state)
    this._setFanOverlay(this.lastMode.fan, "fanSwing", state)
    callback()
}

TadoAccessory.prototype.setFanRotationSpeed = function(speed, callback) {
    var state;
    switch (Math.round(speed)){
        case 100:
            state = "HIGH";
            break;
        case Math.round(this.fanSteps*2):
            state = "MIDDLE";
            break;
        case Math.round(this.fanSteps):
            state = "LOW";
            break;
    }
    this.lastMode.fan.setting.fanSpeed = state
    this.log("Setting " + this.zoneName + " Fan Rotation Speed to " + state)
    this._setFanOverlay(this.lastMode.fan, "fanRotationSpeed", state)
    callback()
}





















/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************    TADO Weather   ******************************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/

function TadoWeather(log, config){
    this.log = log;
    this.name = "Outside Temperature";
    this.homeID = config.homeID;
    this.username = config.username;
    this.password = config.password;
    this.useFahrenheit = config.temperatureUnit == "CELSIUS" ? false : true;
    this.polling = config.polling;
    this.options = {
        host: 'my.tado.com',
        path: '/api/v2/homes/' + this.homeID + '/weather?password=' + this.password + '&username=' + this.username,
        method: 'GET'
    };
    this.callbacks = [];
    this.processing = false

    this.checkWeather = function(callback){
        var self = this;
        self.callbacks.push(callback)
        if (!self.processing) {
            // self.log("Getting status from " + self.name)
            self.processing = true;
            https.request(self.options, function(response){
                var strData = '';
                response.on('data', function(chunk) {
                    strData += chunk;
                });
                response.on('end', function() {
                    try {
                        var data = JSON.parse(strData);
                        var Solar = data.solarIntensity.percentage
                        self.log("Solar Intensity is " + Solar + "%");
                        
                        
                        if (self.useFahrenheit) {
                            self.log("Outside Temperature is " + data.outsideTemperature.fahrenheit + "ºF");
                            var outsideTemperature = data.outsideTemperature.fahrenheit
                        } else {
                            self.log("Outside Temperature is " + data.outsideTemperature.celsius + "ºC");
                            var outsideTemperature = data.outsideTemperature.celsius
                        }
                        for (var i=0; i<self.callbacks.length; i++) {
                            self.callbacks[i](null ,outsideTemperature, Solar);
                        }
                        self.processing = false;
                        self.callbacks = [];
                    }
                    catch(e){
                        self.log("Could not retrieve Outside Temperature, error:" + e);
                        var error = new Error("Could not retrieve Outside Temperature, error:" + e)
                        for (var i=0; i<self.callbacks.length; i++) {
                            self.callbacks[i](error ,null, null);
                        }
                        self.processing = false;
                        self.callbacks = [];
                    }
                });
            }).end();
        }
    }

    this.informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Tado GmbH')
        .setCharacteristic(Characteristic.Model, 'Tado Weather')
        .setCharacteristic(Characteristic.SerialNumber, 'Tado Serial Weather');

    this.TemperatureSensor = new Service.TemperatureSensor(this.name);
    
    this.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getOutsideTemperature.bind(this));

    this.SolarSensor = new Service.Lightbulb("Solar Intensity");

    this.SolarSensor.getCharacteristic(Characteristic.On)
        .on('get', this.getOn.bind(this))
        .on('set', this.setOn.bind(this));

    this.SolarSensor.getCharacteristic(Characteristic.Brightness)
        .setProps({
            maxValue: 100,
            minValue: 0,
            minStep: 0.1
        })
        .on('get', this.getSolar.bind(this))
        .on('set', this.setSolar.bind(this));
    


    if (this.polling){
        var self = this;
        setInterval(function(){
            self.checkWeather(function(err, outsideTemperature, Solar){
                if (!err){
                    self.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(outsideTemperature);
                    self.SolarSensor.getCharacteristic(Characteristic.Brightness).updateValue(Solar);
                    if (Solar > 0){
                        self.SolarSensor.getCharacteristic(Characteristic.On).updateValue(true);
                    } else {
                        self.SolarSensor.getCharacteristic(Characteristic.On).updateValue(false);
                    }
                }
            })
        }, self.polling)
    }
}

TadoWeather.prototype.getServices = function() {
    return [this.TemperatureSensor, this.informationService, this.SolarSensor]
}

TadoWeather.prototype.getOutsideTemperature = function(callback) {
    var self = this
    this.checkWeather(function(err, outsideTemperature, Solar){
        callback(err, outsideTemperature);
    })
}

TadoWeather.prototype.getSolar = function(callback) {
    var self = this
    this.checkWeather(function(err, outsideTemperature, Solar){
        callback(err, Solar);
    })
}

TadoWeather.prototype.getOn = function(callback) {
        var self = this
        this.checkWeather(function(err, outsideTemperature, Solar){
            if (Solar > 0){
                callback(err, true);
            } else {
                callback(err, false);
            }
        })
}


TadoWeather.prototype.setSolar = function(state, callback) {
    var self = this
    callback();
    this.checkWeather(function(err, outsideTemperature, Solar){
        self.SolarSensor.getCharacteristic(Characteristic.Brightness).updateValue(Solar);
    })
}

TadoWeather.prototype.setOn = function(state, callback) {
        var self = this
        callback()
        this.checkWeather(function(err, outsideTemperature, Solar){
            if (Solar > 0){
                self.SolarSensor.getCharacteristic(Characteristic.On).updateValue(true);
            } else {
                self.SolarSensor.getCharacteristic(Characteristic.On).updateValue(false);
            }
        })
}










/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/
/*******************************************************************   TADO Occupancy  ******************************************************************/
/********************************************************************************************************************************************************/
/********************************************************************************************************************************************************/

function occupancySensor(log, config, platform){
    this.log = log;
    this.platform = platform;
    this.name = config.name;
    this.deviceId = config.deviceId
    this.homeID = config.homeID;
    this.username = config.username;
    this.password = config.password;
    this.polling = config.polling;
    this.device = config.device
    this.occupied = 0;
    this.options = {
        host: 'my.tado.com',
        path: '/api/v2/homes/' + this.homeID + '/mobileDevices?password=' + this.password + '&username=' + this.username,
        method: 'GET'
    };

    this.checkOccupancy = function(){
        var self = this;
        https.request(self.options, function(response){
            var strData = '';
            response.on('data', function(chunk) {
                strData += chunk;
            });
            response.on('end', function() {
                try {
                    var data = JSON.parse(strData);
                    for (i=0;i<data.length;i++){
                        if (data[i].id == self.deviceId){
                            if (data[i].location !== null && data[i].location.atHome){
                                if (self.occupied == 0){
                                    self.occupied = 1;
                                    self.log(self.name + " is at Home!");
                                    self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(self.occupied);
                                }
                            } else {
                                if (self.occupied == 1){
                                    self.occupied = 0;
                                    self.log(self.name + " is Out!");
                                    self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(self.occupied);
                                }
                            }
                        }
                    }
                }
                catch(e){
                    self.log("Could not retrieve " + self.name +  " Occupancy Status, error:" + e);
                    var error = new Error("Could not retrieve " + self.name +  " Occupancy Status, error:" + e);
                    callback(error , null, null);
                }
            });
        }).end();
    }

    this.checkAnyone = function(){
        var self = this;
        for(var i = 0; i < self.platform.occupancySensors.length; i++){
            var occupancySensor = self.platform.occupancySensors[i];
            var isOccupied = occupancySensor.occupied;
            if(isOccupied) {
                self.occupied = 1;
                self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(self.occupied);
                return;
            }
        }
        self.occupied = 0;
        self.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected).updateValue(self.occupied);
        return;
    }

    this.informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Tado Occupancy')
        .setCharacteristic(Characteristic.Model, this.device.model)
        .setCharacteristic(Characteristic.SerialNumber, this.device.platform + " " + this.device.osVersion);

    this.OccupancySensor = new Service.OccupancySensor(this.name);
    
    this.OccupancySensor.getCharacteristic(Characteristic.OccupancyDetected)
        .on('get', this.getStatus.bind(this));


    if (this.name == "Anyone"){
        var self = this;
        setTimeout(function(){
            self.checkAnyone();
            setInterval(function(){
                self.checkAnyone();
            }, self.polling)
        }, 300)
        
    } else {
        this.checkOccupancy();
        var self = this;
        setInterval(function(){
            self.checkOccupancy();
        }, self.polling)
    }
    
}

occupancySensor.prototype.getServices = function() {
    return [this.informationService, this.OccupancySensor]
}

occupancySensor.prototype.getStatus = function(callback) {
    if (this.name == "Anyone"){
        if (this.occupied == 1) {
            this.log("Someone is Home!")
        } else {
            this.log("No One is Home!")
        }
    } else {
        if (this.occupied == 1) {
            this.log(this.name + " is at Home!")
        } else {
            this.log(this.name + " is Out!")
        }
    }
    
    callback(null, this.occupied);
}




