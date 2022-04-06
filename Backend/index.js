"use strict"

const express = require('express');
const dotenv = require('dotenv');
const server = express();

const { AuthService } = require('./services/authService.js');
const { MethodService } = require('./services/methodService.js');
const { PhaseService } = require('./services/phaseService.js');

const port = parseInt(process.env.PORT) || 3000;
// Zeitraum in s, bis ein automatischer Logout ausgeführt wird, wenn ein Gerät sich nicht mehr meldet
const waitForLogoutDurance = process.env.LOGOUT_TIME || 100; 
// Angabe, wie viel Zeit zwischen den regelmäßigen Checks der DB z.B. auf zu kurze Phasen oder nicht
// ausgeloggte Teams vergehen soll in ms.
const checkDBInterval = process.env.CHECK_DB_INTERVAL || 5000;
const updateMethodsInterval = process.env.UPDATE_METHODS_INTERVAL || 3600000;

const authService = new AuthService();
const phaseService = new PhaseService();
const methodService = new MethodService();

dotenv.config();
server.use(express.json());


// Einfache Prüfung, ob Verbindung vorhanden ist.
server.get('/checkConnection', (req, res) => {
    res.sendStatus(200);
});

server.get('/newMethod', authService.authenticateJWT, async (req, res) => {
    const data = req.query;
    console.log(data);
    await logData(data, req.mac, req.headers.authorization);
    if (!data || data === '') res.status(400).send('No Data!');
    else {
        try {
            const method = await methodService.changeMethod(parseInt(data.phaseNo), data.protocolId);
            if (!method || method.error) res.status(400).send('Method-Find-Error');
            else {
                console.log('Neue Methode:', method); 
                res.send(method);
            }
        } catch (err) {
            console.log(err);
            res.status(400).send('Unexpected error!');
        }
    }
});

//Login des Geräts mit Mac-Adresse und Key
server.post('/login', async (req, res) => {
    const data = req.body;
    //await logData(data, req.device, req.headers.authorization);

    // Keine Mac oder kein Key im Request -> Kein Zugriff
    if (!data || data === '') res.staus(401).send('No data!');
    if (!data.mac || data.mac === '') res.staus(401).send('No mac address!');
    if (!data.key || data.key === '') res.staus(401).send('No key!');

    try {
        const deviceData = await authService.loginDevice(data);
        // console.log(deviceData);
        if (!deviceData) res.status(401).send('No valid mac-key-combination'); 
        res.send(deviceData);
    } catch (err) {
        console.log(err);
        res.status(400).send('Unexpected error!');
    }
});

// Login des Teams mit Team-Karte.
server.post('/loginTeam', authService.authenticateJWT, async (req, res) => {
    const data = req.body;
    //await logData(data, req.device, req.headers.authorization);

    if (!data || data === '') res.status(400).send('No Data!');
        
    try {
        const teamData = await authService.loginTeam(data.uid);
        console.log('Login Team:', teamData);
        if (!teamData || teamData.error) res.status(400).send('Login-Error');
        else res.send(teamData);
    } catch (err) {
        console.log(err);
        res.status(400).send('Unexpected error!');
    }
});

server.post('/phase', authService.authenticateJWT, async (req, res) => {

    const data = req.body;
    //await logData(data, req.device, req.headers.authorization);

    if (!data || data === '') res.status(400).send('No data!');
    else {  
        try {
            const phaseData = await phaseService.protocolPhase(data);
            if (!phaseData) {
                console.log('Phase not found');
                res.status(400).send('Phase not found!');
            } else {
                //console.log('Phase-Response:');
                //console.log(phaseData);
                if (phaseData.method) console.log('Team', data.team.teamId, 'protokolliert Phase "'+ phaseData.name + '" mit Methode "' + phaseData.method.title + '".');
                res.send(phaseData);
            }
        } catch (err) {
            console.log(err);
            res.status(400).send('Unexpected error!');
        }
    }
});

//TODO: Ändern -> Neues Gerät hinzufügen notwendig??? -> Entfernen????
server.post('/newDevice', async (req, res) => {
    
    const data = req.body
    if (!data  || data === '') req.status(400).send('No data!');
    //await logData(data, null, null);

    try {
        const device = authService.newDevice(data);
        if (!device || device.error) {
            console.log('Decive not found');
            res.status(400).send('Device not found!');
        }
        
        //console.log('Response:');
        //console.log(device);
        res.sendStatus(201);
    } catch (err) {
        console.log(err);
        res.status(400).send('Unexpected error!');
    }
});

server.post('/reflection', authService.authenticateJWT, async (req, res) => {

    const data = req.body;
    //await logData(data, req.device, req.headers.authorization);

    if (!data || data === '') res.status(400).send('No data!');
    else {  
        try {
            const meetingId = data.notReflectedMeeting;
            const text = data.reflectionText;
            const result = await phaseService.setReflection(meetingId, text);
            if (result.error) {
                console.log(result.error);
                res.sendStatus(400);
            } else res.sendStatus(201);
        } catch (err) {
            console.log(err);
            res.status(400).send('Unexpected error!');
        }
    }
});

server.post('/setPause', authService.authenticateJWT, async (req, res) => {

    const data = req.body;
    //await logData(data, req.device, req.headers.authorization);

    if (!data || data === '') res.status(400).send('No data!');
    else {  
        try {
            let response;
            if (data.action === 'start' ) response = await phaseService.setPause(data.team.meetingId, data.action);
            else if (data.action === 'stop' ) response = await phaseService.setPause(data.pauseId, data.action);

            if (!response || response.error) {
                if (res.error) console.log(error);
                res.status(400).send('Unexpected error!');
            } else res.send(response);
        } catch (err) {
            console.log(err);
            res.status(400).send('Unexpected error!');
        }
    }
});

server.post('/skipDescription', authService.authenticateJWT, async (req, res) => {

    const data = req.body;
    //await logData(data, req.device, req.headers.authorization);

    if (!data || data === '') res.sendStatus(400).send('No data!');
    else {
        try {
            let response;

            if (data.type === 'phase') response = await phaseService.setDescriptionSkipped(data.phase.protocolId);
            else if (data.type === 'method') response = await phaseService.setMethodDescriptionSkipped(data.phase.protocolId);

            if (!response || response.error) {
                if (res.error) console.log(error);
                res.status(400).send('Unexpected error!');
            } else res.sendStatus(200);
        } catch (err) {
            console.log(err);
            res.status(400).send('Unexpected error!');
        }
    }

});

// Server horcht auf Port X.
server.listen(port, () => {
    console.log(new Date(Date.now()));
    console.log('Backend-Server läuft auf port', port);
});

const logData = async (data, device, token) => {
    console.log('------------------------------------------');
    console.log(new Date(Date.now()));
    console.log('Daten:');
    console.log(data);
    if(device) {
        console.log('Device:', device)
    }
    if (token) {
        console.log('Token:', token);
    }
}

// Intervall testen regelmäßig, ob falsche Logins vorhanden sind.
setInterval(async() => {
    authService.checkOnlineStatus(waitForLogoutDurance);
    phaseService.checkShortPhases(waitForLogoutDurance);
    phaseService.checkShortMeetings(waitForLogoutDurance);
}, checkDBInterval);

// Regelmäßiges Update der Methoden-Datenbank
setInterval(() => {
    methodService.updateMethods();
}, updateMethodsInterval);