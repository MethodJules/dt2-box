"use strict"

const GPIO = require('onoff').Gpio;
const greenButton = new GPIO(16, 'in', 'both');

const stop = Date.now() + 89000;

setInterval(() => {

    if (greenButton.readSync() === 1) {
        console.log('{"pressedButton":"green"}');
        process.exit();
    }

    if (Date.now() >= stop) {
        console.log('{"pressedButton":"none"}');
        process.exit();
    }

}, 50);
