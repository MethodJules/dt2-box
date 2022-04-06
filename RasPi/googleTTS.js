"use strict"

const GPIO = require('onoff').Gpio;
const fs = require('fs');

const path = '/home/pi/DTDokuTool/temp/vorleseText.txt' // Pfad der zu lesenden Datei
const redButton = new GPIO(12, 'in', 'both');
let textLong = '';

read();

setInterval(() => {
    if (redButton.readSync() === 1) {
        execShellCommand('killall mplayer').then(() => {
            //execShellCommand('/home/pi/DTDokuTool/sprachausgabe_google.sh Abgebrochen!');
            console.log('redButtonStopped');
            process.exit();
        });
    }
}, 50);

// Text ist häufig zu lang, um von Google TTS am Stück in Sprache übersetzt zu werden.
// Daher werden zu lange Texte in einzelne Sätze aufgespalten.
async function read() {

    //Führe aus, wenn die Datei existiert
    try {
        if (!fs.existsSync(path)) {
            console.log('Error: File does not exist!');
            process.exit();
        } else {

            textLong = fs.readFileSync(path).toString();
            let textRead = [];

            // Wenn der Text länger als 200 Zeichen ist -> auftrennen.
            if (textLong.length > 200) {

                // Trenne den Text überall dort, wo ein Punkt (.) steht.
                let text1 = await textLong.split('.');
                for (let i = 0; i < text1.length; i++) {
                    text1[i] = text1[i] + '.';
                }

                // Trenne den Text überall dort, wo ein Punkt (!) steht.
                let text2 = [];
                for (let t of text1) {
                    if (t.split('!').length === 1) {
                        text2.push(t);
                    } else {
                        for (let i = 0; i < t.split('!').length; i++) {
                            if (i < (t.split('!').length - 1)) {
                                text2.push(t.split('!')[i] + '!');
                            } else {
                                text2.push(t.split('!')[i]);
                            }
                        }
                    }
                }
                
                // Trenne den Text überall dort, wo ein Punkt (?) steht.
                let text3 = [];
                for (let t of text2) {
                    if (t.split('?').length === 1) {
                        text3.push(t);
                    } else {
                        for (let i = 0; i < t.split('?').length; i++) {
                            if (i < (t.split('?').length - 1)) {
                                text3.push(t.split('?')[i] + '?');
                            } else {
                                text3.push(t.split('?')[i]);
                            }
                        }
                    }
                }
    
            // Google TTS lässt in dieser (kostenlosen) Version nur max. 200 Zeichen zu.
            // Daher wird ein Satz, der länger ist, nochmal geteilt.
                for (let t of text3) {
                    if (t.length <= 200 && t !== '.' && t !== '!' && t !== '?' && t !== '' && t !== '\n' && t !== '\r') {
                        textRead.push(t.replace('\n', '').replace('\r', ''));
                    } else if (t !== '.' && t !== '!' && t !== '?') {
                        const splittedText = splitAtComma(t);
                        for (let s of splittedText) {
                            // Auch alle Umbruch-Zeichen (\r und \n) sowie leere Strings entfernen. 
                            if (s !== '' && s !== '\n' && s !== '\r') {
                                textRead.push(s.replace('\n', '').replace('\r', ''));
                            }
                        }
                    }
                }
            } else {
                //Wenn der Text kürzer als 200 Zeichen ist -> So lassen.
                textRead[0] = textLong;
            }
            
            // Gebe das Text-Array aus.
            console.log('TextRead:');
            console.log(textRead);

            // Alle Elemente des Arrays nacheinander abspielen
            for (let t of textRead) {
                try {
                    if (!fs.existsSync(path)) {
                        console.log('Error: File does not exist!');
                        process.exit();
                    } else {
                        const textTest = fs.readFileSync(path).toString();
                        if (textTest === textLong) {
                            await execShellCommand('/home/pi/DTDokuTool/sprachausgabe_google.sh ' + t);
                        } else {
                            console.log('Text changed');
                            process.exit();
                        }
                    }
                } catch {
                    console.log('Error:', err.message);
                    process.exit();
                }
            }

            process.exit();
        }

    } catch(err) {
        console.log('Error:', err.message);
        process.exit();
    }
}


function execShellCommand(cmd) {
    const exec = require('child_process').exec;
    
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(error);
            }
            resolve(stdout? stdout : stderr);
        });
    });
}

// String an geeigneter Stelle teilen, bis die Teile kurz genug sind.
function splitAtComma(str) {
    
    let strArr = [str];
    let tooLong = true;

    while (tooLong) {

        let tempArr = strArr;
        strArr = [];

        for (let temp of tempArr) {
            for (let i = 199; i >= 0; i--) {
                if (temp.charAt(i) === ',') {
                    strArr.push(temp.substring(0, i + 1));
                    strArr.push(temp.substring(i + 1));
                    break;
                }
            }
        }

        //console.log('strArr:');
        //console.log(strArr);

        tooLong = false;
        for (let s of strArr) {
            if (s.length > 200) {
                tooLong = true;
                break;
            }
        }
    }

    return strArr;
}
