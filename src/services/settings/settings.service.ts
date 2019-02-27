import { Injectable } from '@angular/core';

import { Platform } from 'ionic-angular';

//Services
import { StorageService } from '../storage/storage.service';
import { DeviceManagerService } from 'dip-angular2/services';

interface firmwareUrls {
    prettyName: string
    listUrl: string
    devListUrl: string
    firmwareUrl: string
    devFirmwareUrl: string
}

@Injectable()
export class SettingsService {

    public storageService: StorageService;
    public deviceManagerService: DeviceManagerService;
    public defaultConsoleLog;
    public logArguments = [];
    public logLength: number = 50;
    public nestedChannels: boolean = false;
    public routeToStore: boolean = true;
    public drawLaOnTimeline: boolean = false;
    public wflVersion: string = '1.4.8';
    public useDevBuilds: boolean = false;
    public androidAppLink = "market://details?id=com.digilent.waveformslive";
    public iosAppLink = "https://itunes.apple.com/us/app/waveforms-live/id1244242035";
    public isMobile: boolean = false;

    readonly profileToken: string = 'profile.';
    private selectedLogProfiles: any = {};

    public knownFirmwareUrls: { openscopeMz: firmwareUrls, openloggerMz: firmwareUrls } = {
        openscopeMz: {
            prettyName: 'OpenScope MZ',
            listUrl: 'https://s3-us-west-2.amazonaws.com/digilent?prefix=Software/OpenScope+MZ/release/firmware/without-bootloader',
            devListUrl: 'https://s3-us-west-2.amazonaws.com/digilent?prefix=Software/OpenScope+MZ/development/firmware/without-bootloader',
            firmwareUrl: 'https://s3-us-west-2.amazonaws.com/digilent/Software/OpenScope+MZ/release/firmware/without-bootloader',
            devFirmwareUrl: 'https://s3-us-west-2.amazonaws.com/digilent/Software/OpenScope+MZ/development/firmware/without-bootloader'
        },
        openloggerMz: {
            prettyName: 'OpenLogger MZ',
            listUrl: 'https://s3-us-west-2.amazonaws.com/digilent?prefix=Software/OpenLogger+MZ/release/firmware/without-bootloader',
            devListUrl: 'https://s3-us-west-2.amazonaws.com/digilent?prefix=Software/OpenLogger+MZ/development/firmware/without-bootloader',
            firmwareUrl: 'https://s3-us-west-2.amazonaws.com/digilent/Software/OpenLogger+MZ/release/firmware/without-bootloader',
            devFirmwareUrl: 'https://s3-us-west-2.amazonaws.com/digilent/Software/OpenLogger+MZ/development/firmware/without-bootloader'
        }
    };

    private loggerBufferSize: number = 5;

    constructor(_storageService: StorageService, _deviceManagerService: DeviceManagerService, public platform: Platform) {
        console.log('settings service constructor');
        window.addEventListener('beforeunload', (event) => {
            this.storageService.saveData('appLog', JSON.stringify({log:this.logArguments})).catch((e) => {
                console.warn(e);
            });
        });

        this.storageService = _storageService;
        this.deviceManagerService = _deviceManagerService;
        this.defaultConsoleLog = window.console.log;

        this.storageService.getData('routeToStore').then((data) => {
            if (data != null) {
                this.routeToStore = JSON.parse(data);
            }
        });

        this.storageService.getData('useDevBuilds').then((data) => {
            if (data != undefined) {
                this.useDevBuilds = JSON.parse(data);
            }
        });

        this.storageService.getData('appLog').then((data) => {
            if (data == undefined) { return; }
            let parsedData = JSON.parse(data);
            this.logArguments = parsedData.log;
        });

        this.storageService.getData('httpTimeout').then((data) => {
            console.log(data);
            if (data == undefined) { return; }
            let parsedData = JSON.parse(data);
            this.deviceManagerService.setHttpTimeout(parsedData.timeout);
        });

        this.storageService.getData('loggerBufferSize').then((data) => {
            this.loggerBufferSize = parseFloat(data) || this.loggerBufferSize;
        });
        
        if (this.platform.is('ios') || this.platform.is('android') || this.platform.is('mobileweb')) {
            this.isMobile = true;
        }

        this.storageService.getData('selectedLogProfiles').then((data) => {
            if (data != undefined) {
                this.selectedLogProfiles = JSON.parse(data);
            }
        });
    }

    setRouteToStore(route: boolean) {
        this.routeToStore = route;
        this.storageService.saveData('routeToStore', JSON.stringify(this.routeToStore)).catch((e) => {
            console.warn(e);
        });
    }

    setUseDevBuilds(useDevBuilds: boolean) {
        this.useDevBuilds = useDevBuilds;
        this.storageService.saveData('useDevBuilds', JSON.stringify(this.useDevBuilds)).catch((e) => {
            console.warn(e);
        });
    }

    getRouteToStore(): boolean {
        return this.routeToStore;
    }

    setNestedChannels(nested: boolean) {
        this.nestedChannels = nested;
    }

    getActiveDeviceInfo() {
        if (this.deviceManagerService.devices.length < 1 || this.deviceManagerService.activeDeviceIndex == undefined) {
            return undefined;
        }
        let dev = this.deviceManagerService.devices[this.deviceManagerService.activeDeviceIndex];
        let versionArray = [dev.firmwareVersion.major.toString(), dev.firmwareVersion.minor.toString(), dev.firmwareVersion.patch.toString()];
        return {
            deviceMake: dev.deviceMake,
            deviceModel: dev.deviceModel,
            firmwareVersion: versionArray.join('.'),
            rootUri: dev.rootUri
        };
    }

    changeConsoleLog(type: 'Local Storage' | 'Both' | 'None' | 'Console') {
        if (type === 'Console') {
            window.console.log = this.defaultConsoleLog;
        }
        else if (type === 'Local Storage') {
            window.console.log = this.localStorageLog.bind(this);
        }
        else if (type === 'Both') {
            window.console.log = this.bothLog.bind(this);
        }
        else if (type === 'None') {
            window.console.log = this.log;
        }
    }

    log() {}

    localStorageLog(argumentArray?) {
        for (let i = 0; i < arguments.length; i++) {
            let arg = arguments[i];
            if (typeof(arg) === 'object') {
                let cache = new Set();
                arg = JSON.stringify(arg, (key, value) => {
                    if (typeof(value) === 'object' && value !== null) {
                        if (cache.has(value)) {
                            try {
                                return JSON.parse(JSON.stringify(value));
                            } catch (err) {
                                return '[object]';
                            }
                        }
                        cache.add(value);
                    }
                    return value;
                });
            }
            this.logArguments.push(arg);
        }
        let logLength = this.logArguments.length;
        if (logLength > this.logLength) {
            this.logArguments = this.logArguments.slice(logLength - this.logLength);
        }
    }

    pushLogToLocalStorage() {

    }

    bothLog() {
        this.localStorageLog(arguments);
        if (this.defaultConsoleLog.apply) {
            this.defaultConsoleLog.apply(window.console, arguments);
        }
        else {
            let message = Array.prototype.slice.apply(arguments).join(' ');
            this.defaultConsoleLog(message);
        }
    }

    exportLogFile() {
        let fileName = 'WaveFormsLiveLogs.txt';
        let csvContent = 'data:text/csv;charset=utf-8,';
        if (this.logArguments.length === 0) {
            csvContent += 'No Logs Found\n';
        }
        else {
            for (let i = 0; i < this.logArguments.length; i++) {
                csvContent += this.logArguments[i] + '\r\n';
            }
        }
        let encodedUri = encodeURI(csvContent);
        let link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
    }

    clearAppLog() {
        this.logArguments = [];
        this.storageService.removeDataByKey('appLog');
    }

    setHttpTimeout(newTimeout: number) {
        this.deviceManagerService.setHttpTimeout(newTimeout);
        console.log(this.deviceManagerService.getHttpTimeout());
        this.storageService.saveData('httpTimeout', JSON.stringify({timeout: this.deviceManagerService.getHttpTimeout()})).catch((e) => {
            console.warn(e);
        });
    }

    getLoggerBufferSize(): number{
        return this.loggerBufferSize;
    }

    setLoggerBufferSize(size: number) {
        this.loggerBufferSize = size;

        this.storageService.saveData('loggerBufferSize', JSON.stringify(this.loggerBufferSize)).catch((e) => {
            console.warn(e);
        });
    }

    getLoggerProfile(macAddress: string) {
        return this.selectedLogProfiles[macAddress];
    }

    saveLoggerProfile(macAddress: string, profileName: string) {
        this.selectedLogProfiles[macAddress] = profileName;

        this.storageService.saveData('selectedLogProfiles', JSON.stringify(this.selectedLogProfiles))
            .catch((e) => {
                console.warn(e);
            });
    }
}