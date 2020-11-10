const unified = require('./unified')

module.exports = (device, platform) => {

	const setTimeoutDelay = 500
	let setTimer = null
	let preventTurningOff = false
	const tadoApi = platform.tadoApi

	const log = platform.log
	// const state = device.state

	return {
		get: (target, prop) => {
			// check for last update and refresh state if needed
			if (!platform.setProcessing)
				platform.refreshState.ac()

			// return a function to update state (multiple properties)
			if (prop === 'update')
				return (state) => {
					if (!platform.setProcessing) {
						Object.keys(state).forEach(key => { 
							if (state[key] !== null)
								target[key] = state[key] 
						})
						device.updateHomeKit()
					}
				}


			return target[prop]
		},
	
		set: async (state, prop, value) => {
			
			if (prop in state && state[prop] === value)
				return

			state[prop] = value
			
			// Send Reset Filter command and update value
			if (prop === 'manualControl' && !value) {
				try {
					await tadoApi.setDeviceState(device.id, null)
				} catch(err) {
					log('Error occurred! -> Climate React state did not change')
				}
				
				if (!platform.setProcessing)
					platform.refreshState.ac()
				return
			}
	

			platform.setProcessing = true

			// Make sure device is not turning off when setting fanSpeed to 0 (AUTO)
			if (prop === 'fanSpeed' && value === 0 && device.capabilities[state.mode].autoFanSpeed)
				preventTurningOff = true
				
			
			clearTimeout(setTimer)
			setTimer = setTimeout(async function() {
				// Make sure device is not turning off when setting fanSpeed to 0 (AUTO)
				if (preventTurningOff && state.active === false) {
					state.active = true
					preventTurningOff = false
				}
		
				const tadoOverlay = unified.tadoOverlay(platform, device, state)
				log(device.name, ' -> Setting New State:')
				log(JSON.stringify(tadoOverlay, null, 2))
				
				try {
					// send state command to tado°
					await tadoApi.setDeviceState(device.id, tadoOverlay)
				} catch(err) {
					log(`ERROR setting ${prop} to ${value}`)
					setTimeout(() => {
						platform.setProcessing = false
						platform.refreshState.ac()
					}, 1000)
					return
				}
				setTimeout(() => {
					device.updateHomeKit()
					platform.setProcessing = false
				}, 500)

			}, setTimeoutDelay)

			return true;
		}
	}
}