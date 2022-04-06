"use strict"

const GPIO = require('onoff').Gpio;
const redButton = new GPIO(12, 'in', 'both');
const greenButton = new GPIO(16, 'in', 'both');

const stop = Date.now() + 12000;

setInterval(() => {

    if (redButton.readSync() === 1) {
        console.log('{"pressedButton":"red"}');
        process.exit();
    }

    if (greenButton.readSync() === 1) {
        console.log('{"pressedButton":"green"}');
        process.exit();
    }

    if (Date.now() >= stop) {
        console.log('{"pressedButton":"none"}');
        process.exit();
    }
    
}, 50);
