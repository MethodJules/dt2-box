"use strict"

const fs = require('fs');
const GPIO = require('onoff').Gpio;
const redButton = new GPIO(12, 'in', 'both');

const path = '/home/pi/DTDokuTool/temp/checkStopButton.tmp';

setInterval(() => {

    if (redButton.readSync() === 1) {
        const start = Date.now();
        while (true) {
            if (redButton.readSync() === 0) break;
            if (Date.now() - start > 2500) break; 
        }
        const stop = Date.now();

        if (stop - start >= 2500) {
            console.log('{"status":"stop"}');
            process.exit();
        }
    }
    
    if (!fs.existsSync(path)) {
        process.exit();
    }

}, 50);