"use strict"

const fs = require('fs');
const GPIO = require('onoff').Gpio;
const greenButton = new GPIO(16, 'in', 'both');

const path = '/home/pi/DTDokuTool/temp/breakButtonCheck.tmp';
let paused = false;

setInterval(() => {

    if (greenButton.readSync() === 1) {
        const start = Date.now();
        while (true) {
            if (greenButton.readSync() === 0) break;
            if (Date.now() - start > 2500) break; 
        }
        const stop = Date.now();

        if (stop - start >= 2500) {
            if (paused === false) {
                paused = true;
                console.log('{"status":"paused"}');
            } else {
                paused = false;
                console.log('{"status":"running"}');
            }
        } 
    }
    
    if (!fs.existsSync(path)) {
        process.exit();
    }

}, 50);