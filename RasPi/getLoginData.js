'use strict'

const os = require('os');
const fs = require('fs');
const path = '/home/pi/DTDokuTool/key';

getData();

async function getData() {

    const mac = os.networkInterfaces().wlan0[0].mac;
    const key = await readKey();

    const data = {
        mac: mac,
        key: key
    }
    console.log(JSON.stringify(data));
}


async function readKey() {
    try {
        if (!fs.existsSync(path)) {
            process.stderr.write('Keine Schluessel-Datei gefunden. Login beim Server nicht moeglich!');
            process.exit();
        } else {
            return fs.readFileSync(path).toString();
        }
    } catch (err) {
        console.log('Error:', err.message);
    }
    
}