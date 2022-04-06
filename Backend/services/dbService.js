"use strict"

const mariadb = require('mariadb');
const dotenv = require ('dotenv');
const { Meeting } = require('../classes/meeting.js');
const { query } = require('express');
const { Method } = require('../classes/method.js');

dotenv.config();

const pool = mariadb.createPool({
    host: process.env.DB_ADDRESS || 'localhost',
    user: process.env.DB_USERNAME || 'root',
    port: process.env.DB_PORT || '3306', 
    password: process.env.DB_PASSWORD || 'DT_Doku_Tool',
    database: process.env.DB_NAME || 'dt_doku_tool',
    timezone: 'utc',
    connectionLimit: 5
});

//Alle SQL-Queries zusammengefasst:
const Queries = {
    AUTO_LOGOUT: 'UPDATE teams SET current_phase = null WHERE last_seen < ? AND current_phase IS NOT NULL;',
    DELETE_SHORT_MEETINGS: 'DELETE FROM meetings WHERE end < ? AND TIMESTAMPDIFF(SECOND, begin, end) < ?;',
    DELETE_SHORT_PHASES: 'DELETE FROM phase_protocol WHERE end < ? AND TIMESTAMPDIFF(SECOND, begin, end) < ?;',
    END_OPEN_PAUSES: 'UPDATE pauses INNER JOIN meetings ON (pauses.meeting = meetings.id) INNER JOIN teams ON (meetings.team = teams.id) ' 
        + 'SET pauses.end = ? WHERE pauses.end IS NULL AND TIMESTAMPDIFF(SECOND, teams.last_seen, ?) > ?;',
    GET_ALL_METHODS: 'SELECT * FROM methods;',
    GET_CURRENT_MEETING: 'SELECT id FROM meetings WHERE team = ? ORDER BY end DESC;',
    GET_CURRENT_PHASE: 'SELECT current_phase FROM teams WHERE id = ?;',
    GET_DEVICE_DATA: 'SELECT * FROM devices WHERE mac = ?;',
    GET_LAST_MEETING: 'SELECT * FROM meetings WHERE team = ? ORDER BY end DESC LIMIT 1;',
    GET_LAST_PHASE_AND_MEETING: 'SELECT methods.title as method, phases.name as phase FROM phase_protocol INNER JOIN phases '
        + 'ON (phase_protocol.phase = phases.id) INNER JOIN methods ON (phase_protocol.method = methods.id) WHERE team = ? ORDER BY end DESC LIMIT 1;',
    GET_METHODS_BY_PHASE: 'SELECT * FROM methods WHERE phase = ?;',
    GET_PHASE: 'SELECT * FROM phases WHERE model = ? AND uid = ?;',
    GET_PHASE_PROTOCOLS: 'SELECT id, model, meeting, phase, method, begin, end FROM phase_protocol WHERE team = ? ORDER BY end DESC;',
    GET_TEAM_DATA: 'SELECT students.first_name as firstName, students.last_name as lastName, teams.last_seen as lastSeen, teams.id as teamId, '
        + 'teams.name as name, models.name as model, models.id as modelId FROM teams JOIN students ON (teams.id = students.team) JOIN models '
        + 'ON (teams.model = models.id) WHERE teams.uid = ?;',
    INSERT_NEW_DEVICE: 'INSERT INTO devices VALUES (?, ?);',
    INSERT_NEW_MEETING: 'INSERT INTO meetings VALUES (?, ?, ?, ?, null);',
    INSERT_NEW_METHODS: 'INSERT INTO methods VALUES(null, ?, ?, ?, ?, ?, ?)',
    INSERT_NEW_PAUSE: 'INSERT INTO pauses VALUES (null, ?, ?, null);',
    INSERT_NEW_PHASE: 'INSERT INTO phase_protocol VALUES(?, (SELECT id FROM teams WHERE uid = ?), ?, ?, (SELECT id FROM phases '
        + 'WHERE model = ? AND uid = ?), ?, ?, ?, false, false)',
    UPDATE_DESCRIPTION_SKIPPED: 'UPDATE phase_protocol SET description_skipped = true WHERE id = ?;',
    UPDATE_LAST_SEEN: 'UPDATE teams SET last_seen = ? WHERE uid = ?;',
    UPDATE_CHANGED_METHODS: 'UPDATE methods SET title = ?, model = ?, phase = ?, description = ?, timebox = ?, members = ? WHERE id = ?;',
    UPDATE_CURRENT_PHASE: 'UPDATE teams SET current_phase = (SELECT id from phases WHERE model = ? AND uid = ?) WHERE uid = ?;',
    UPDATE_LOGIN_TIME: 'UPDATE teams SET last_login = ?, last_seen = ? WHERE uid = ?;',
    UPDATE_MEETING: 'UPDATE meetings SET end = ? WHERE id = ?;',
    UPDATE_METHOD: 'UPDATE phase_protocol SET method = ? WHERE id = ?;',
    UPDATE_METHOD_DESCRIPTION_SKIPPED: 'UPDATE phase_protocol SET method_description_skipped = true WHERE id = ?;',
    UPDATE_PAUSE_END: 'UPDATE pauses SET end = ? WHERE id = ?;',
    UPDATE_PHASE: 'UPDATE phase_protocol SET end = ? where id = ?;',
    UPDATE_REFLECTION: 'UPDATE meetings set reflection = ? WHERE id = ?;'
}

class DBService {

    constructor() {};

    changeMethod = async (protocolId, method) => {
        if (!protocolId || !method ) return;
        let con;
        try {
            con = await pool.getConnection();
            con.beginTransaction()
            await con.query(Queries.UPDATE_METHOD, [ method.id, protocolId ]);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    checkOnlineStatus = async (period) => {
        if (!period) return;

        let con;
        const periodAgo = await createMariaDBDate(new Date(Date.now() - (period * 1000)));
        const mariaDBDate = await createMariaDBDate(new Date());

        try {
            con = await pool.getConnection();
            con.beginTransaction();
            // Logge alles Teams aus, die länger nicht gesehen wurden.
            const res = await con.query(Queries.AUTO_LOGOUT, [ periodAgo ]);
            await con.query(Queries.END_OPEN_PAUSES, [ mariaDBDate, mariaDBDate, 60 ]);
            con.commit();
            if (res.affectedRows > 0) {
                console.log('------------------------------------------');
                console.log(new Date(Date.now()));
                console.log(res.affectedRows + ' Team(s) automatisch ausgeloggt!');
            }
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    deleteTooShortMeetings = async (period) => {
        if (!period) return;
        let con;
        const mariaDBDate = await createMariaDBDate(new Date(Date.now() - period * 1000))
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            const res = await con.query(Queries.DELETE_SHORT_MEETINGS, [ mariaDBDate, 60 ]);
            if (res.affectedRows > 0) console.log(res.affectedRows, 'Sitzung(en) entfernt.');
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    deleteTooShortPhases = async (period) => {
        if (!period) return;
        let con;
        const mariaDBDate = await createMariaDBDate(new Date(Date.now() - period * 1000))
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            const res = await con.query(Queries.DELETE_SHORT_PHASES, [ mariaDBDate, 60 ]);
            if (res.affectedRows > 0) console.log(res.affectedRows, 'Phase(n) entfernt.');
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    getAllMethods = async () => {
        let con;
        try {
            con = await pool.getConnection();
            const rows = await con.query(Queries.GET_ALL_METHODS);
            if (!rows) return;
            const methods = [];
            for (const r of rows) {
                methods.push(new Method(r.id, r.title, r.model, r.room, r.phase, r.description, r.members, r.timebox)); 
            }
            return methods;
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    getCurrentMeeting = async (teamId) => {
        if(!teamId) return;
        let con;
        try {
            con = await pool.getConnection();
            const rows = await con.query(Queries.GET_CURRENT_MEETING, [ teamId ]);
            if (!rows || rows.length === 0 ) return;
            return rows[0];
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    getCurrentPhase = async (modelId, phaseUId) => {
        if (!modelId || !phaseUId) return;

        let con;
        try {
            con = await  pool.getConnection();
            const rows = await con.query(Queries.GET_PHASE, [ modelId, phaseUId ]);
            if (!rows || rows.length === 0) return;
            return rows[0];
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    // Daten des Geräts aus der DB holen
    getDeviceData = async (data) => {
        if (!data) return;
        let con;
        try {
            con = await pool.getConnection();
            const rows = await con.query(Queries.GET_DEVICE_DATA, [ data.mac ]);
            //Mac nicht vorhanden -> Kein Zugriff
            if (!rows || rows.length === 0) return; 
            return rows[0];
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    getLastNotReflectedMeeting= async (teamId) => {
        if (!teamId) return;
        let con;
        try {
            con = await pool.getConnection();
            const rows = await con.query(Queries.GET_LAST_MEETING, [ teamId ]);
            if (!rows || rows.length === 0) return; 
            const meeting = rows[0];
            if (meeting.reflection !== undefined && meeting.reflection !== null) return;
            return meeting;
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    getLastPhase = async (teamId) => {
        if (!teamId) return;
        let con;
        try {
            con = await pool.getConnection();
            const rows = await con.query(Queries.GET_PHASE_PROTOCOLS, [ teamId ]);
            if (!rows || rows.length === 0) return; 
            return rows[0];
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    getLastPhaseAndMeeting = async (teamId) => {
        if (!teamId) return;
        let con;
        try {
            con = await pool.getConnection();
            const rows = await con.query(Queries.GET_LAST_PHASE_AND_MEETING, [ teamId ]);
            if (!rows || rows.length === 0) return; 
            return rows[0];
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    getMethodsByPhase = async (phaseNo) => {
        if (!phaseNo) return;
        let con;
        try {
            con = await pool.getConnection();
            const rows = await con.query(Queries.GET_METHODS_BY_PHASE, [ phaseNo ]);
            if (!rows) return; 
            const methods = [];
            for (const r of rows) {
                methods.push(r);
            }
            return methods;
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    getTeamData = async (uid) => {
        if (!uid) return;
        let con;
        try {
            con = await pool.getConnection();
            const rows = await con.query(Queries.GET_TEAM_DATA, [ uid ]);
            if (!rows || rows.length === 0) return;
            let team = [];
            for (let r of rows) {
                team.push(r);
            }
            return team;
        } catch (err) {
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    insertNewMeeting = async (teamId) => {
        if (!teamId) return;
        let con;
        const mariaDBDate = await createMariaDBDate(new Date());
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            const res = await con.query(Queries.INSERT_NEW_MEETING, [ null, teamId, mariaDBDate, mariaDBDate ]);
            con.commit();
            if (res.affectedRows === 0) return;
            return new Meeting(res.insertId, teamId, mariaDBDate, mariaDBDate, null);
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    insertNewMethods = async (newMethods) => {
        if (!newMethods || newMethods.length === 0) return;
        const methods = [];
        for (const n of newMethods) {
            methods.push([ n.title, n.model, n.phase, n.description || null, n.timebox || null, n.members || null ]);
        }
        let con;
        try {
            con = await pool.getConnection();
            con.beginTransaction()
            await con.batch(Queries.INSERT_NEW_METHODS, methods);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    insertNewPause = async (meetingId) => {
        if (!meetingId) return;
        let con;
        const mariaDBDate = await createMariaDBDate(new Date());
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            const res = await con.query(Queries.INSERT_NEW_PAUSE, [ meetingId, mariaDBDate ]);
            con.commit();
            if (!res || res.affectedRows === 0) return;
            return { pauseId: res.insertId };
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    insertNewPhase = async (tagData, teamData, method) => {
        if (!tagData || !teamData) return;
        if (!method) return;
        let con;
        const mariaDBDate = await createMariaDBDate(new Date());
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            con.query(Queries.UPDATE_CURRENT_PHASE, [ teamData.modelId, tagData.uid, teamData.uid ]);
            let res = await con.query(Queries.INSERT_NEW_PHASE, [null, teamData.uid, teamData.modelId, teamData.meetingId, teamData.modelId, tagData.uid, method.id, mariaDBDate, mariaDBDate]);
            con.commit();
            if (res.affectedRows === 0) return;
            return { phaseId: res.insertId };
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }  
    }

    updateCurrentPhaseEmpty = async (tagData, teamData) => {
        if (!tagData || !teamData) return;
        let con;
        try {
            con = await pool.getConnection();
            await con.beginTransaction();

            // Kein Tag auf dem Reader, daher uid leer. -> last_seen updaten, aber keine Abfrage der Phase nötig.
            this.updateLastSeen(teamData.uid);
            // Wenn sich die Phase geändert hat -> Änderung in der DB speichern.
            if (tagData.statusChanged || tagData.protocolId === undefined) {
                con.query(Queries.UPDATE_CURRENT_PHASE, [ teamData.modelId, null, teamData.uid ]);
            }
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    updateLastSeen = async (teamUId) => {
        if (!teamUId) return;
        let con;
        try {
            con = await pool.getConnection();
            await con.beginTransaction();
            const mariaDBDate = await createMariaDBDate(new Date());
            con.query(Queries.UPDATE_LAST_SEEN, [ mariaDBDate, teamUId ]);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    updateLoginTime = async (uid) => {
        if (!uid) return;
        let con
        const mariaDBDate = await createMariaDBDate(new Date());

        try {
            con = await pool.getConnection();
            con.beginTransaction();
            con.query(Queries.UPDATE_LOGIN_TIME, [ mariaDBDate, mariaDBDate, uid ]);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    updateMeeting = async (meetingId) => {
        if (!meetingId) return;
        let con
        const mariaDBDate = await createMariaDBDate(new Date());

        try {
            con = await pool.getConnection();
            con.beginTransaction();
            con.query(Queries.UPDATE_MEETING, [ mariaDBDate, meetingId ]);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    updateMethods = async (changedMethods) => {
        if (!changedMethods || changedMethods.length === 0) return;
        const methods = [];
        for (const c of changedMethods) {
            if (c.id) {
                methods.push([ c.title, c.model, c.phase, c.description || null, c.timebox || null, c.members || null, c.id ]);
            }
        }
        let con;
        try {
            con = await pool.getConnection();
            con.beginTransaction()
            await con.batch(Queries.UPDATE_CHANGED_METHODS, methods);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        } 
    }

    updatePauseEnd = async (pauseId) => {
        if (!pauseId) return;
        let con
        const mariaDBDate = await createMariaDBDate(new Date());
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            con.query(Queries.UPDATE_PAUSE_END, [ mariaDBDate, pauseId ]);
            con.commit();
            return ({ pauseId });
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    updatePhase = async (protocolId) => {
        if (!protocolId) return;
        let con
        const mariaDBDate = await createMariaDBDate(new Date());

        try {
            con = await pool.getConnection();
            con.beginTransaction();
            con.query(Queries.UPDATE_PHASE, [ mariaDBDate, protocolId ]);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    updateReflection = async (text, meetingId) => {
        if (!meetingId) return;
        if (text === undefined || text === null) return;
        let con
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            con.query(Queries.UPDATE_REFLECTION, [ text, meetingId ]);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }
    
    setDescriptionSkipped = async (protocolId) => {
        if (!protocolId) return;
        let con
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            con.query(Queries.UPDATE_DESCRIPTION_SKIPPED, [ protocolId ]);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }

    setMethodDescriptionSkipped = async (protocolId) => {
        if (!protocolId) return;
        let con
        try {
            con = await pool.getConnection();
            con.beginTransaction();
            con.query(Queries.UPDATE_METHOD_DESCRIPTION_SKIPPED, [ protocolId ]);
            con.commit();
        } catch (err) {
            con.rollback();
            throw err;
        } finally {
            if (con) con.end();
        }
    }
}

// Erstellt aus einem JS-Date-Objekt eine DateTime im MariaDB-Format.
const createMariaDBDate = async (date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { DBService };
