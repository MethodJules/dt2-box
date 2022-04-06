"use strict"

const fs = require('fs');
const GPIO = require('onoff').Gpio;
const greenButton = new GPIO(16, 'in', 'both');

const path = '/home/pi/DTDokuTool/temp/buttonCheck.tmp';

setInterval(() => {

    if (greenButton.readSync() === 1) {
        console.log('{"pressedButton":"green"}');
        process.exit();
    }
    
    if (!fs.existsSync(path)) {
        process.exit();
    }

}, 50);
