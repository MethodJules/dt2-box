'use strict'

class Method {

    id;
    title;
    model;
    room;
    phase;
    description;
    members;
    timebox;

    constructor (id, title, modelId, room, phase, description, members, timebox) {
        this.id = id;
        this.title = title;
        this.model = modelId;
        this.room = room
        this.phase = phase;
        this.description = description;
        this.members = members;
        this.timebox = timebox;
    }
}

module.exports = { Method }