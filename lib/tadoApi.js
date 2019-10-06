const https = require('https')

module.exports = {

    getToken: (username, password, callback) => {
        const options = {
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
                // console.log("strData:", strData)
                try {
                    const data = JSON.parse(strData)
                    token = data.access_token
                    if (data.error) {
                        console.error(data)
                        callback (data.error)   
                    } else
                        callback(null, token)
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse token data:')
                    console.log(strData)
                    callback (e)
                }
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },

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
                    homeId = JSON.parse(strData).homes[0].id
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (JSON.parse(strData).error) console.error(JSON.parse(strData))
                callback(null, homeId)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },

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
                    temperatureUnit = JSON.parse(strData).temperatureUnit
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (JSON.parse(strData).error) console.error(JSON.parse(strData))
                callback(null, temperatureUnit)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },

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
                    zones = JSON.parse(strData)
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (zones.error) console.error(zones)
                callback(null, zones)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },

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
                    capabilities = JSON.parse(strData)
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (capabilities.error) console.error(capabilities)
                callback(null, capabilities)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },

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
                    users = JSON.parse(strData)
                    trackedUsers = users.filter(user => {
                        const geoTrackingEnabled = user.mobileDevices.find(device =>
                            device.settings.geoTrackingEnabled
                        )
                        return geoTrackingEnabled
                    })
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (users.error) console.error(users)
                callback(null, trackedUsers)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },

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
                    state = JSON.parse(strData)
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (state.error) console.error(state)
                callback(null, state)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },

    setOverlay: (username, password, homeId, zone, overlay, token, debug, callback) => {
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
                    data = JSON.parse(strData)
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                    callback(e)
                }
                if (data.error) console.error(data)
                if (debug) console.log('setOverlay response:', data)
                callback(null, data)
                return
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end(overlay)
    },


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
                    weather = JSON.parse(strData)
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (weather.error) console.error(weather)
                callback(null, weather)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },


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
                    mobileDevices = JSON.parse(strData)
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (mobileDevices.error) console.error(mobileDevices)
                callback(null, mobileDevices)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    },

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
                    installations = JSON.parse(strData)
                } catch (e) {
                    console.error(e)
                    console.log('Couldn\'t Parse strData:')
                    console.log(strData)
                }
                if (installations.error) console.error(installations)
                callback(null, installations)
            })
        }).on('error', (e) => {
            console.error(e)
            callback(e)
        }).end()
    }

}