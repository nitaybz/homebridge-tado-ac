homebridge-tado-ac (V2)
========================

Homebridge Plugin for Tado Smart AC Control.

Complies with ```Service.HeaterCooler```

Compatible with ***iOS 11 and above*** -  iOS 10 Home app does not support this service.

### Whats New in Version 2 ??

This version is a whole new build that brings a lot more options to controling your Air Conditiner with Homekit:

1. Homebridge plugin turned into platform to support 1 eco-system.
2. Device auto detection - the plugin automatically detects and add any Tado AC device.
3. HomeKit Air Conditiner Support.
4. Support for ***Swing*** and ***Rotation Speed*** of the air conditioner
5. Fan Support - as different accessory. 
6. Auto configuration - The plugin detects the capabilities of your AC (set by Tado) and set them up accordingly in Homekit: 
    - Zone Id
    - Home Id 
    - Min/Max Temperature
    - Modes (AUTO/COOL/HEAT/FAN)
    - Temperature Unit
    - Swing
    - Rotation Speeds
7. Humidity sensor as a seperated accessory 
8. Much faster status update - makes the accessories load much faster in Home app
9. Easy config - Only username and password are required now to enjoy all features.

This version does not support manual configuration other than the *TadoMode*.
To use old version feel free to install from [GitHub](https://github.com/nitaybz/homebridge-tado-ac-old): 
`sudo npm install -g https://github.com/nitaybz/homebridge-tado-ac-old.git`

## Installation

1. Install homebridge using: `sudo npm install -g homebridge`
2. Install this plugin using: `sudo npm install -g homebridge-tado-ac`
3. Update your configuration file. See `sample-config.json` in this repository for a sample.

**install from git (latest version): `sudo npm install -g https://github.com/nitaybz/homebridge-tado-ac.git`

## Config file

```
"platforms": [
    {
        "platform": "TadoAC",
        "name": "Tado AC",
        "username": user@name.com",
        "password": "*************",
        "tadoMode": "MANUAL"
    }
]
```
## Configuration

|             Parameter            |                       Description                       | Required |  Default  |
| -------------------------------- | ------------------------------------------------------- |:--------:|:---------:|
| `platform`                       | always "TadoAC"                                         |     ✓    |      -    |
| `name`                           | name of the platform - for logs only                    |          |      -    |
| `username`                       | your tado account username (something@something.com)    |     ✓    |      -    |
| `password`                       | your tado account password                              |     ✓    |      -    |
| `tadoMode`                       | default mode for the commands to be sent with. can be "MANUAL" for manual control until ended by the user, or "TADO_MODE" for manual control until next schedule change in tado app .          |             |  "MANUAL" |


## Troubleshooting

I tried my best to make this version flawless, but expect some issues since each user has his own different setup.
Once a new issue is noticed, please submit to [Issues](https://github.com/nitaybz/homebridge-tado-ac/issues)

There might be an issue with Farenheit Temperature Unit - Let me know if it needs to be fixed

