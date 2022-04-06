'use strict'

class Team {

    constructor (uid, team, teamId, meetingId, model, modelId, members, timestamp, notReflectedMeeting) {
        this.uid = uid; 
        this.team = team;
        this.teamId = teamId;
        this.meetingId = meetingId;
        this.model = model;
        this.modelId = modelId;
        this.members = members;
        this.timestamp = timestamp;
        this.notReflectedMeeting = notReflectedMeeting;
    }

    setData(name, teamId, meetingId, model, modelId, notReflectedMeeting, lastPhase, lastMethod) {
        this.team = name;
        this.teamId = teamId;
        this.meetingId = meetingId;
        this.model = model;
        this.modelId = modelId;
        this.notReflectedMeeting = notReflectedMeeting;
        this.lastPhase = lastPhase;
        this.lastMethod = lastMethod;
    }
}

module.exports = { Team }
