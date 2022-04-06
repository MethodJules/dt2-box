'use strict'

const fs = require('fs');
const speech = require('@google-cloud/speech');

const client = new speech.SpeechClient();

const path = '/home/pi/DTDokuTool/audio/sttFile.raw';
const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'de-DE';

const config = {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
};

const audio = {
     content: fs.readFileSync(path).toString('base64'),
};

const request = {
    config: config,
    audio: audio,
};

sst();

async function sst() {
    console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    const [response] = await client.recognize(request);
    const transcription = response.results
        .map(result => result.alternatives[0].transcript)
        .join('\n');
    console.log('Transcription: ', transcription);
}
