const { exec } = require("child_process");
const fs = require('fs');

const pitch = 50 // Stimmhöhe, Wert zwischen 0 und 99
const speed = 160 // Geschwindigkeit, Wert von 80 bis 450
const loudness = 100 // Lautstärke, Wert von 0 bis 200
const voice = 'de+f2' // Bezeichnung der verwendeten Stimme aus dem voices-Ordner von Espeak
const path = '/home/pi/DTDokuTool/probeText.txt' // Pfad der zu lesenden Datei

read();

async function read() {

    //Führe aus, wenn die Datei existiert
    try {
        if (!fs.existsSync(path)) {
            console.log('Error: File does not exist!');
            process.exit();
        } else {
            exec('espeak -a ' + loudness + ' -v ' + voice + ' -f ' + path + ' -s ' + speed + ' -p ' + pitch +  ' --stdout | aplay ', (error, stdout, stderr) => {
                if (error) {
                    console.log('Error:', error.message);
                    return;
                }
                if (stderr) {
                    console.log('Stderr:', stderr);
                    return;
                }
                console.log('Stdout:', stdout);
            })
        }

    } catch(err) {
        console.log('Error: ${error.message}');
        process.exit();
    }
}
