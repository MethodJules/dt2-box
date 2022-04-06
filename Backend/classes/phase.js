'use strict'

class Phase {

    constructor(uid, id, number, name, description, model, method, protocolId, timestamp) {
        this.uid = uid;
        this.id = id;
        this.no = number;
        this.name = name;
        this.description = description;
        this.model = model;
        this.method = method;
        this.protocolId = protocolId;
        this.timestamp = timestamp;
        this.continuePhase = false;
    }

    setData(name, id, no, description, model, method, continuePhase) {
        this.name = name;
        this.no = id;
        this.no = no;
        this.description = description;
        this.model = model;
        this.method = method;
        this.continuePhase = continuePhase;
    }
}

module.exports = { Phase };