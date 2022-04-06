'use strict'

class Meeting {

    constructor (id, teamId, begin, end, reflection) {
        this.id = id;
        this.teamId = teamId;
        this.begin = begin;
        this.end = end;
        this.reflection = reflection;
    }
}

module.exports = { Meeting }