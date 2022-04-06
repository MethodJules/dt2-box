'use strict'

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DBService }= require('./dbService');
const { Team } = require('../classes/team.js');

const jwtExpireTime = 3600; //Anzahl Sekunden Gültigkeit des JWT

class AuthService {

    constructor() {
        this.dbService = new DBService();
    };

    // Middleware authentifiziert Token
    authenticateJWT = (req, res, next) => {
        console.log('hdhdhd');
        const authHeader = req.headers['authorization'];
        // Keyword "BEARER" steht vor dem Token. Daher Token an Stelle [1]
        const accessToken = authHeader && authHeader.split(' ')[1];
        // Kein AccessToken -> Kein Zugriff.
        if (accessToken == null) return res.sendStatus(401);

        //Token verifizieren. Wenn OK -> Weiterleiten, sonst Code 401 zurückgeben und kein Zugriff.
        jwt.verify(accessToken, process.env.ACCESS_TOKEN_PRIVATE_KEY, (err, data) => {
            if (err) return res.sendStatus(401);
            //console.log('------------------------------------------');
            //console.log('Verifizierungsdaten:');
            //console.log(data);
            req.mac = data.mac;
            next();
        });
    }

    // Hole alle Teams aus der DB, bei denen die letze Meldung länger als X Sekunden zurückliegt
    // und die immer noch eingeloggt sind.
    checkOnlineStatus = async (period) => {
        if (!period || period === '') return;
        try {
            this.dbService.checkOnlineStatus(period);
        } catch (err) {
            throw err;
        }
    }

    // Gerät einloggen und Token erstellen
    loginDevice = async (data) => {

        // Daten des Geräts aus der DB holen
        const deviceData = await this.dbService.getDeviceData(data);
        if (!deviceData) return;

        try {
            // Mac und Key OK (validiert mit Bcrypt) -> Zugriff gestatten
            // und JWT generieren
            if (await bcrypt.compare(data.key, deviceData.key)) {
                const now = Date.now();
                const accessToken = jwt.sign({ mac: data.mac, timestamp: now }, process.env.ACCESS_TOKEN_PRIVATE_KEY, { expiresIn: jwtExpireTime });
                const expireTime = now + (jwtExpireTime * 1000);
                console.log('Gerät ' + data.mac + ' erfolgreich eingeloggt.');
                return { accessToken, expireTime };
            // Key nicht OK -> Kein Zugriff
            } else {
                console.log('Gerät ' + data.mac + ': Login fehlgeschlagen.');
                return;
            }
        //Fehler -> Kein Zugriff
        } catch (err) {
            throw err;
        }
    }

    // Loggt Team über seine Teamkarten-ID ein.
    loginTeam = async (cardId) => {
        if (!cardId || cardId === '') return;

        // Rückgabe mit leeren Team-Daten erstellen
        let response = new Team(cardId, '', 0, 0, '', 0, [], Date.now(), null);

        try {
            // Teamdaten zur Teamkarten-ID aus der Datenbank holen.
            const teamMembers = await this.dbService.getTeamData(cardId);
            let team;
            // Wenn die ID nicht in der DB vorhanden ist:
            if (!teamMembers) return response;
            team = teamMembers[0];

            let meetingId = 0;
            let notReflectedMeeting;

            this.dbService.updateLoginTime(cardId);
            const lastPhaseData = await this.dbService.getLastPhaseAndMeeting(team.teamId) || {};

            // Login protokollieren und Neues Meeting erstellen, falls die letzte Sitzung sauber beendet wurde.
            if (team.lastSeen > new Date(Date.now() - 60000)) {
                const meeting = await this.dbService.getCurrentMeeting(team.teamId);
                if (!meeting) return;
                this.dbService.updateMeeting(meeting.id);
                meetingId = meeting.id;
            } else {
                notReflectedMeeting = await this.dbService.getLastNotReflectedMeeting(team.teamId);
                const meeting = await this.dbService.insertNewMeeting(team.teamId);
                if (!meeting) return response;
                meetingId = meeting.id;
            }

            // Liste der Teammmitglieder zusammenstellen und Daten in Response eintragen.
            for (let t of teamMembers) {
                response.members.push(t.firstName);
            }
            response.setData(team.name, team.teamId, meetingId, team.model, team.modelId, notReflectedMeeting, lastPhaseData.phase, lastPhaseData.method);
            return response;
        } catch (err) {
            throw err;
        } 
    }

    // Neues Gerät erstellen (TEST)
    // TODO: Entfernen der Funktion.
    newDevice = async (data) => {

        let con;
        try {
            con = await pool.getConnection();
            try {
                const salt = await bcrypt.genSalt();
                const hashedKey = await bcrypt.hash(data.key, salt);
                const device = { mac: data.mac, hashedKey };
                con.query(Queries.INSERT_NEW_DEVICE, [ data.mac, hashedKey ]);
                return(device);
            } catch (err) {
                throw err;
            }
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }  
    }
}

module.exports = { AuthService };
