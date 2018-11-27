const https = require('https')

const tadoApi = module.exports = () => {
    
    getToken: (username, password, callback) => {
        const  options = {
            host: 'auth.tado.com',
            path: '/oauth/token?client_id=tado-web-app&client_secret=wZaRN7rpjn3FoNyF5IFuxg9uMzYJcvOoQ8QWiIqS3hfk6gLhVlG57j5YNoZL2Rtc&grant_type=password&password=' + password + '&scope=home.user&username=' + username,
            method: 'POST'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const token = JSON.parse(strData).access_token
                    callback(null, token)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

    getHomeId: (username, password, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/me?password=' + password + '&username=' + username,
            method: 'GET'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const homeId = JSON.parse(strData).homes[0].id
                    callback(null, homeId)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

    getTemperatureUnit: (username, password, homeId, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '?password=' + password + '&username=' + username,
            method: 'GET'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const temperatureUnit = JSON.parse(strData).temperatureUnit
                    callback(null, temperatureUnit)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

    getZones: (username, password, homeId, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '/zones?password=' + password + '&username=' + username,
            method: 'GET'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const zones = JSON.parse(strData)
                    callback(null, zones)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

    getZoneCapabilities: (username, password, homeId, zone, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '/zones/' + zone + '/capabilities?password=' + password + '&username=' + username,
            method: 'GET'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const capabilities = JSON.parse(strData)
                    callback(null, capabilities)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }
    
    getTrackedUsers: (username, password, homeId, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '/users?password=' + password + '&username=' + username,
            method: 'GET'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const users = JSON.parse(strData)
                    const trackedUsers = users.filter(user => {
                        const geoTrackingEnabled = user.mobileDevices.find(device => 
                            device.settings.geoTrackingEnabled
                        )
                        return geoTrackingEnabled
                    })
                    callback(null, trackedUsers)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

    getState: (username, password, homeId, zone, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '/zones/' + zone + '/state?username=' + username + '&password=' + password,
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const state = JSON.parse(strData)
                    callback(null, state)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

    setOverlay: (username, password, homeId, zone, overlay, token, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '/zones/' + zone + '/overlay?username=' + username + '&password=' + password,
            method: overlay == null ? 'DELETE' : 'PUT',
            headers: {
                'authorization': 'Bearer ' + token,
                'data-binary': overlay,
                'Content-Type': 'application/json;charset=UTF-8'
            }
        }
        
        if (overlay) overlay = JSON.stringify(overlay)
        
        // console.log("zone: " + zone + ",  body: " + overlay)

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const data = JSON.parse(strData)
                    callback(null, data)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end(overlay)
    }


    getWeather: (username, password, homeId, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '/weather?password=' + password + '&username=' + username,
            method: 'GET'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const weather = JSON.parse(strData)
                    callback(null, weather)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }


    getMobileDevices: (username, password, homeId, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '/mobileDevices?password=' + password + '&username=' + username,
            method: 'GET'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const mobileDevices = JSON.parse(strData)
                    callback(null, mobileDevices)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

    // for Thermostatic control check
    getInstallations: (username, password, homeId, callback) => {
        const options = {
            host: 'my.tado.com',
            path: '/api/v2/homes/' + homeId + '/installations?password=' + password + '&username=' + username,
            method: 'GET'
        }

        https.request(options, (res) => {
            let strData = ''
            res.on('data', (d) => {
                strData += d
            })
            res.on('end', () => {
                //console.log("strData:" + strData)
                try {
                    const installations = JSON.parse(strData)
                    callback(null, installations)
                }
                catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

}