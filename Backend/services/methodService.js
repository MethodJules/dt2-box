'use strict'

const fetch = require('node-fetch');
const { DBService } = require('./dbService');
const { Method } = require('../classes/method.js');
const ISUM_URL = "https://it-studienprojekt.hosting.uni-hildesheim.de/jsonapi/node/methode";

class MethodService {

    constructor() {
        this.dbService = new DBService();
    }

    changeMethod = async (phaseNo, protocolId) => {
        if (!phaseNo) return { error: 'No phaseNo' };
        if (!protocolId) return { error: 'No protocolId' };
        try {
            const method = await this.getRandomMethod(phaseNo);
            if (!method) return { error: 'Error getting random method' };
            this.dbService.changeMethod(protocolId, method);
            return method;
        } catch (err) {
            throw err;
        }
    }

    cleanString = async (oldString) => {
        try {
            if (oldString.includes('<img')) return;
            let newString = oldString;
            let startIndex;
            while ((startIndex = newString.search('<')) != -1) {
                let endIndex = newString.search('>');
                if (endIndex != -1 && endIndex > startIndex) {
                    newString = newString.substring(0, startIndex) + newString.substring(endIndex + 1);
                } else newString = newString.replace('<', '');
            }
            if (newString.search('Quellen') > -1) {
                newString = newString.substring(0, newString.search('Quellen'));
            }
            return newString.replace(/\r/g, '').replace(/\n/g, '').replace(/\t/g, '').replace(/\&nbsp/g, ' ').replace(/;/g, '');
        } catch {
            return "Fehler";
        }
    }

    createDescription = async (attr) => {
        let description = 'Es sind leider keine Informationen über diese Methode vorhanden.';
        if (!attr.body && !attr.field_beispiel && !attr.field_vorgehen) return description;
        description = '';
        try {
            if (attr.body && attr.body.value) {
                description += 'Beschreibung: ' + await this.cleanString(attr.body.value);
            }
            if (attr.field_vorgehen && attr.field_vorgehen.value) {
                description += ' Vorgehen: '+ await this.cleanString(attr.field_vorgehen.value);
            }
            if (attr.field_ziele && attr.field_ziele.value) {
                description += ' Ziel: ' + await this.cleanString(attr.field_ziele.value);
            }
            if (attr.field_beispiel && attr.field_beispiel.value && await this.cleanString(attr.field_beispiel.value)) {
                description += ' Beispiel: ' + await this.cleanString(attr.field_beispiel.value);
            }
            return description;
        } catch (err) {
            console.log('Fehler bei der Erzeugung der Beschreibung von Node', attr.id);
        }
    }

    createMethods = async (methodsJson, rooms, thinkings) => {
        const methods = [];
        for (let m of methodsJson) {
            if (m.type !== 'node--methode') break;
            const attr = m.attributes;
            const relation = m.relationships;
            if (!attr) break;
            const title = await this.seperateTitle(attr);
            const room = await this.getRoom(relation, rooms);
            const phase = await this.getPhase(relation, room, thinkings);
            const timebox = await this.readTimebox(attr);
            const members = await this.readMembers(attr);
            const description = await this.createDescription(attr);
            if (title && phase && description) {
                const method = new Method(null, title, 1, room, phase, description, members, timebox);
                methods.push(method);
            }
        }
        //console.log(methods);
        return methods;
    }

    findChangedMethods = async (oldMethods, methods) => {
        if (!methods || !oldMethods) return;
        const changedMethods = [];
        for (const m of methods) {
            const oldMethod = oldMethods.find(o => o.title === m.title);
            if (m.timebox === undefined) m.timebox = null;
            if (oldMethod !== undefined && (
                oldMethod.phase !== m.phase ||
                oldMethod.model !== m.model ||
                oldMethod.description !== m.description ||
                oldMethod.members !== m.members ||
                oldMethod.timebox !== m.timebox)) {
                m.id = oldMethod.id;
                changedMethods.push(m);
            }
        }
        return changedMethods;
    }

    findNewMethods = async (oldMethods, methods) => {
        if (!methods || !oldMethods) return;
        const newMethods = [];
        for (const m of methods) {
            if (oldMethods.find(o => o.title === m.title) === undefined) {
                newMethods.push(m);
            }
        }
        return newMethods;
    }

    getAllMethods = async (phaseNo) => {
        if (!phaseNo) return { error: 'No phaseNo' };
        try {
            let methods = await this.dbService.getMethodsByPhase(phaseNo);
            if (!methods || methods.length === 0) return { error: 'No method found' };
            return methods; 
        } catch (err) {
            throw err;
        }
    }

    getAllThinkings = async (methodsJson) => {
        let thinkings = await this.getThinkingData(methodsJson);
        thinkings = await this.getThinkingNames(thinkings);
        //console.log('ALLE Denkweisen:');
        //console.log(thinkings);
        return thinkings;
    }

    getAllRooms = async (methodsJson) => {
        let rooms = await this.getRoomData(methodsJson);
        rooms = await this.getRoomNames(rooms);
        //console.log('ALLE RÄUME:');
        //console.log(rooms);
        return rooms;
    }

    getPhase = async (relation, room, thinkings) => {
        if (!room || !relation.field_raum.data || !relation.field_phase.data) return;
        const thinking = thinkings.find(t => t.id === relation.field_phase.data.id).thinking;
        try {
            switch (room) {
                case "Problemraum":
                    if (thinking === 'divergent') return 1;
                    if (thinking === 'konvergent') return 2;
                    return;
                case "Lösungsraum":
                    if (thinking === 'divergent') return 3;
                    if (thinking === 'konvergent') return 4;
                    return;
                case "Implementierungsraum":
                    if (thinking === 'divergent') return 5;
                    if (thinking === 'konvergent') return 6;
                    return;
            }
        } catch (err) {
            console.log('Keine oder fehlerhafte Angaben zur Phase');
        }
    }

    getThinkingData = async (methodsJson) => {
        const phaseData = [];
        for (const m of methodsJson) {
            try {
                const url = m.relationships.field_phase.links.related.href;
                const id = m.relationships.field_phase.data.id;
                const phase = { id, url };
                if (phaseData.find(p => p.id === phase.id) === undefined) {
                    phaseData.push(phase);
                }
                if (phaseData.length === 3) break;
            } catch {
                console.log('Node', m.id, 'fehlen Angaben zur Phase!');
            }
        }
        return phaseData;
    }

    getThinkingNames = async (phases) => {
        for (const p of phases) {
            try {
                const data = await this.requestData(p.url);
                const phaseThinking = data.attributes.name;
                p.thinking = phaseThinking;
            } catch (err) {
                console.log(err);
            }
        }
        return phases;
    }

    getRandomMethod = async (phaseNo) => {
        if (!phaseNo) return { error: 'No phaseNo' };
        try {
            let methods = await this.dbService.getMethodsByPhase(phaseNo);
            if (!methods || methods.length === 0) return { error: 'No method found' };
            const method = methods[Math.floor(Math.random() * methods.length)];
            return method; 
        } catch (err) {
            throw err;
        }
    }

    getRoom = async (relation, rooms) => {
        if (!relation.field_raum) return;
        try {
            const room = rooms.find(r => r.id === relation.field_raum.data.id);
            return room.name;
        } catch (err) {
            console.log('Keine oder fehlerhafte Angaben zum Raum.');
            //console.log(err);
            return;
        }
    }

    getRoomData = async (methodsJson) => {
        const roomData = [];
        for (const m of methodsJson) {
            try {
                const url = m.relationships.field_raum.links.related.href;
                const id = m.relationships.field_raum.data.id;
                const room = { id, url };
                if (roomData.find(r => r.id === room.id) === undefined) {
                    roomData.push(room);
                }
                if (roomData.length === 3) break;
            } catch {
                console.log('Node', m.id, 'fehlen Angaben zum Raum!');
            }
        }
        return roomData;
    }

    getRoomNames = async (rooms) => {
        for (const r of rooms) {
            try {
                const data = await this.requestData(r.url);
                const roomName = data.attributes.name;
                r.name = roomName;
            } catch (err) {
                console.log(err);
            }
        }
        return rooms;
    }

    readMembers = async (attr) => {
        if (!attr.field_beteiligte) return;
        let members = this.cleanString(attr.field_beteiligte.value);
        return members;
    }

    readTimebox = async (attr) => {
        if (!attr.field_benoetigte_zeit) return null;
        try {
            let timeString = attr.field_benoetigte_zeit.value;
            timeString = timeString.substr(0, timeString.indexOf(','));
            const timebox = parseInt(timeString);
            if (isNaN(timebox)) return null;
            return timebox;
        } catch {
            console.log('Node', attr.title, 'fehlen Angaben über die benötigte Zeit.');
        }
    }

    requestData = async (url) => {
        try {
            const response = await fetch(url);
            const resJson = await response.json();
            return resJson.data;
        } catch (err) {
            console.log(err);
        }
    }

    seperateTitle = async (attr) => {
        if (!attr || !attr.title) return;
        const together = attr.title;
        const bracketOpen = together.indexOf('(');
        if (bracketOpen === -1) return together;
        const title = together.substring(0, bracketOpen - 1);
        return title;
    }


    updateMethods = async () => {
        console.log('Lade Methoden aus der ISUM DB');
        const methodsJson = await this.requestData(ISUM_URL);
        const rooms = await this.getAllRooms(methodsJson);
        const thinkings = await this.getAllThinkings(methodsJson);
        const methods = await this.createMethods(methodsJson, rooms, thinkings);
        this.updateMethodsDB(methods);
    }

    updateMethodsDB = async (methods) => {
        console.log('Jetzt werden die neuen Methoden in die DB geschrieben.');
        const oldMethods = await this.dbService.getAllMethods();
        const changedMethods = await this.findChangedMethods(oldMethods, methods);
        const newMethods = await this.findNewMethods(oldMethods, methods);
        this.dbService.insertNewMethods(newMethods);
        this.dbService.updateMethods(changedMethods);
        console.log('Neue Methoden:', newMethods.length);
        console.log('Geänderte Methoden:', changedMethods.length);
    }
}

module.exports = { MethodService };
