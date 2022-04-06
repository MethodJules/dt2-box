"use strict"

const fs = require('fs');
const path = '/home/pi/DTDokuTool/temp/continueWelcomeLoop.tmp';

console.log('Hallo, ich bin bereit. Bitte loggt euch mit eurer Teamkarte ein!');

setInterval(async () => {

    try {
        // Solange die Datei existiert, wird der Text immer wieder ausgegeben.
        if (fs.existsSync(path)) {
            console.log('Hallo, ich bin bereit. Bitte loggt euch mit eurer Teamkarte ein!');
        // Wenn die Datei gelöscht ist, wird der Loop beendet
        } else {
            process.exit();
        }
    } catch(err) {
        // Mach gar nix!
        console.log('Error', err.message);
    }

}, 30000);