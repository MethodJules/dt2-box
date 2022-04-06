'use strict'

const { DBService } = require('./dbService.js');
const { MethodService } = require('./methodService.js');
const { Phase } = require('../classes/phase.js');
const dotenv = require('dotenv');

dotenv.config();
// Anzahl Sekunden, die eine Figur von der Box entfernt werden und wieder aufgestellt
// werden kann, sodass die Phase fortgesetzt wird, statt eine neue zu erzeugen.
const CONTINUE_PHASE_INTERVAL = process.env.CONTINUE_PHASE_INTERVAL || 30;

class PhaseService {

    constructor() {
        this.dbService = new DBService();
        this.methodService = new MethodService();
    }
    
    checkShortMeetings = async (period) => {
        if (!period || period === '') return { error: 'No period' };
        try {
            this.dbService.deleteTooShortMeetings(period);
        } catch (err) {
            throw err;
        }
    }

    checkShortPhases = async (period) => {
        if (!period || period === '') return { error: 'No period' };
        try {
            this.dbService.deleteTooShortPhases(period);
        } catch (err) {
            throw err;
        }
    }

    distinguishPhaseCases = async (teamData, tagData, phaseData, phase, response) => {
        try {
            // Methoden dieser Phase aus der Methoden-DB holen, falls sie bisher noch nicht gesetzt war.
            let method = phaseData.method;
            let continuePhase = false;
            if (phase.number && !method) {
                continuePhase = await this.isMethodActive(phase.id, teamData);
                if (!continuePhase) method = await this.methodService.getRandomMethod(phase.number);
            }
            // Wenn sich die Phase geändert hat -> Änderung in DB speichern und neue Phase anlegen
            if (!continuePhase && (tagData.statusChanged || tagData.protocolId === undefined)) {
                console.log('Method saved to Phase:', method);
                const res = await this.dbService.insertNewPhase(tagData, teamData, method);
                if (!res) return { error: 'Error during phase insertion process.'};
                response.protocolId = res.phaseId;
            // Keine neue Phase -> aktuell laufende Phase verlängern (= Ende updaten)
            } else if (continuePhase) {
                const protocol = await this.getLastPhaseOfTeam(teamData.teamId);
                console.log(protocol);
                if (!protocol) return { error: 'Error during phase insertion process.'};
                this.dbService.updatePhase(protocol.id);
                const methods = await this.methodService.getAllMethods(phase.number);
                console.log(methods);
                console.log(protocol.method);
                method = methods.filter(method => method.id === protocol.method)[0];
                response.protocolId = protocol.id;
            } else {
                this.dbService.updatePhase(tagData.protocolId);
            }
            // Daten in Response schreiben und zurückgeben
            response.setData(phase.name, phase.id, phase.number, phase.description, phase.model, method, continuePhase);
            return response;
        } catch (err) {
            throw err;
        }
    }

    endOpenPauses = async (period) => {
        if (!period || period === '') return { error: 'No period' };
        try {
            this.dbService.endOpenPauses(period);
        } catch (err) {
            throw err;
        }
    }

    getLastPhaseOfTeam = async (teamId) => {
        if (!teamId || teamId === '') return { error: "No TeamID" };
        try {
            const phase = await this.dbService.getLastPhase(teamId);
            return phase;
        } catch (err) {
            throw err;
        }
    }

    isMethodActive = async (phaseId, teamData) => {
        if (!phaseId || phaseId === '') return { error: "No phaseID" };
        if (!teamData || !teamData.meetingId || !teamData.teamId) return { error: "No teamID" };
        try {
            const lastPhase = await this.getLastPhaseOfTeam(teamData.teamId);
            if (!lastPhase) return false;
            if (lastPhase.meeting === teamData.meetingId && lastPhase.phase === phaseId && lastPhase.end > new Date(Date.now() - CONTINUE_PHASE_INTERVAL * 1000)) {
                return true;
            }
            return false;
        } catch (err) {
            throw err;
        }
    }

    // Protokolliert die Phase in der Datenbank
    protocolPhase = async (data) => {
    
        // Teamdaten und Phasendaten aus den Daten ziehen.
        if (!data) return { error: 'No data!' };
        if (!data.team) return { error: 'No team!' };

        const teamData = data.team;
        try {
            // LastSeen updaten und die Sitzung verlängern
            this.dbService.updateLastSeen(teamData.uid);
            this.dbService.updateMeeting(teamData.meetingId);
        } catch (err) {
            throw err;
        }

        if (!data.tag) return { error: 'No tag!' };
        const tagData = data.tag;
        const phaseData = data.phase;
        try {
            return await this.updatePhase(teamData, tagData, phaseData);
        } catch (err) {
            throw err;
        }
    }

    setDescriptionSkipped = async (protocolId) => {
        if (!protocolId || protocolId === '') return { error: "No protocolId" };
        try {
            await this.dbService.setDescriptionSkipped(protocolId);
            return {};
        } catch (err) {
            throw err;
        }
    }

    setMethodDescriptionSkipped = async (protocolId) => {
        if (!protocolId || protocolId === '') return { error: "No protocolId" };
        try {
            await this.dbService.setMethodDescriptionSkipped(protocolId);
            return {};
        } catch (err) {
            throw err;
        }
    }

    setPause = async (id, action) => {
        if (!id || id === '') return { error: 'No id'};
        if (!action || action === '') return { error: 'No action selected'};
        try {
            let res;
            if (action === 'start') res = await this.dbService.insertNewPause(id);
            if (action === 'stop') res = await this.dbService.updatePauseEnd(id);
            return res;
        } catch {
            throw err;
        }
    }

    setReflection = async (meetingId, text) => {
        if (!meetingId) return { error: "No meetingId" };
        if (text === undefined || text === null) return { error: "No text" };
        try {
            await this.dbService.updateReflection(text, meetingId);
            return {};
        } catch (err) {
            throw err;
        }
    }

    updatePhase = async (teamData, tagData, phaseData) => {
        // Format der Response festgelegt.
        const response = new Phase(tagData.uid, 0, 0, '', '', '', null, tagData.protocolId, Date.now());

        try {
            //Wenn kein Tag vorhanden ist -> leere Phase zurückgeben, nichts protokollieren.
            if(tagData.status === 'No Tag') return response;

            // Kein Tag auf dem Reader, daher uid leer. -> lastSeen updaten, aber keine Abfrage der Phase nötig.
            if (tagData.uid === '') {
                this.dbService.updateCurrentPhaseEmpty(tagData, teamData);
            }
            // Daten der aktuellen Phase auslesen
            const phase = await this.dbService.getCurrentPhase(teamData.modelId, tagData.uid);
    
            //Fehler in Daten: Fehler zurückgeben.
            if (!phase) {
                response.phase = 'ERROR';
                return response;
            }

            return await this.distinguishPhaseCases(teamData, tagData, phaseData, phase, response);
        } catch (err) {
            throw err;
        } 
    }
}

module.exports = { PhaseService }
