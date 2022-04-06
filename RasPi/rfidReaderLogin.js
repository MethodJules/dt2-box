"use strict";
const RFIDreader = require('mfrc522-rpi');
const SoftSPI = require('rpi-softspi');
const fs = require('fs');
const path = '/home/pi/DTDokuTool/temp/continueRFID.tmp';

// Es gibt grundsätzlich zwei Stati für den Reader: Tag vorhanden oder nicht
const RFIDStatus = {
  TAG: 'Tag',
  NO_TAG: 'No Tag',
  ERROR: 'Error'
}

const softSPI = new SoftSPI({
  clock: 23, // Pin, an den SCLK angeschlossen wird
  mosi: 19, // Pin, an den MOSI angeschlossen wird
  miso: 21, // Pin, an den MISO angeschlossen wird
  client: 24 // Pin, an den CS angeschlossen wird
});

// Setze den Reset-Pin und den Pin für einen optionalen Buzzer auf 22 und 18
// Problem: Der hier genutzte Pin wiederholt das Piepen bei jedem erfolgreichen Scan
// Für Dauerscans daher nicht zu gebrauchen.
const mfrc522 = new RFIDreader(softSPI).setResetPin(22).setBuzzerPin(18);

// Es werden Statusänderungen registriert, indem mit dem letzten Tag verglichen wird.
let currentTag = '';

// Standardformat der Nachricht für die Weiterverarbeitung mit NodeRED
let JSONmessage = {
  uid: '',
  timestamp: Date.now(),
  status: RFIDStatus.NO_TAG,
  statusChanged: false,
  type: 0,
  memory: 0
}

setInterval(() => {

  //Führe aus, bis die Datei nicht mehr existiert
  try {
    // Solange die Datei existiert, wird der Text immer wieder ausgegeben.
    if (!fs.existsSync(path)) {
        process.exit();
    }
  } catch(err) {
      // Mach gar nix!
  }

  //Karte resetten
  mfrc522.reset();
  JSONmessage.timestamp = Date.now();
  JSONmessage.statusChanged = false;

  // Nach RFID-Tags scannen
  let response = mfrc522.findCard();
  if (!response.status) {
    if (currentTag === '') {
      if (JSONmessage.uid != '') {
        JSONmessage.statusChanged = true;
      }
      JSONmessage.uid = '';
      JSONmessage.status = RFIDStatus.NO_TAG;
      console.log(JSON.stringify(JSONmessage));
      return JSONmessage;
    } else {
      currentTag = '';
      return;
    }
  }

  JSONmessage.status = RFIDStatus.TAG;

  let bitSize = response.bitSize
  JSONmessage.type = bitSize;
  //console.log("RFID-Tag erkannt, Typ: " + bitSize);

  // UID auslesen
  response = mfrc522.getUid();

  // Bei Fehler: Abbruch
  if (!response.status) {
    //console.log("UID Error");
    JSONmessage.status = RFIDStatus.ERROR;
    console.log(JSON.stringify(JSONmessage));
    return JSONmessage;
  }

  // UID in String umwandeln
  const uid = response.data;
  const uidString = uid[0].toString(16) + uid[1].toString(16) + uid[2].toString(16) + uid[3].toString(16);

  if (uidString != JSONmessage.uid) {
    JSONmessage.statusChanged = true;
  }
  //console.log("RFID_Tag UID: " + uidString);
  currentTag = uidString;
  JSONmessage.uid = uidString;

  // Speichergröße auslesen
  const memoryCapacity = mfrc522.selectCard(uid);
  JSONmessage.memory = memoryCapacity;
  //console.log("Speicherplatz: " + memoryCapacity);

  // Default-Werte für Authentifizierung
  const key = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

  // Authentifizierung
  if (!mfrc522.authenticate(8, key, uid)) {
    //console.log("Authentication Error");
    JSONmessage.status = RFIDStatus.ERROR;
    console.log(JSON.stringify(JSONmessage));
    return;
  }
  //console.log("Block: 8 Daten: " + mfrc522.getDataForBlock(8));

  // Vorgang beenden
  mfrc522.stopCrypto();

  console.log(JSON.stringify(JSONmessage));
  return JSONmessage;

// Intervall von 500ms hat sich beim Test als optimal herausgestellt.
// Ist das Intervall kürzer, überschneiden sich die Scanvorgänge, was zu Fehlern führt.
}, 500);