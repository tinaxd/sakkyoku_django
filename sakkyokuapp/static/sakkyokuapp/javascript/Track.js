/**
 * A track has notes, an instrument, and methods to remove and add Notes
 * @param instrument The instrument used in the track
 */

const midiWorker = new Worker("static/sakkyokuapp/javascript/WebMIDIWorker.js");

class GlobalMIDIPlayer {
    constructor() {
        this.player = new WebMIDIPlayer();
        this.player.requestMIDIAccess();
        this.sched = new WebMIDIScheduler(50, this.player);
    }

    createChannel() {
        const chan = new MessageChannel();
        chan.port1.onmessage = this.onmessage.bind(this);
        return chan.port2;
    }

    onmessage(d) {
        const e = d.data;
        switch (e.instruction) {
        case 'schedule-now':
            this.sched.scheduleNow(e.data);
            break;
        case 'schedule-with-delay':
            this.sched.scheduleNowWithDelay(e.data, e.delayMillis);
            break;
        }
    }
}

const gMidiPlayer = new GlobalMIDIPlayer();
const port2 = gMidiPlayer.createChannel();
midiWorker.postMessage(null, [port2]);

class Track {
    constructor(instrumentID, song, trackNumber) {
        this.song = song;
        //this.sched = new WebAudioScheduler({ context: audioCtx });
        this.gainNode = audioCtx.createGain();
        this.setVolume(90);
        this.notes = [];
        this.instrumentID = instrumentID;
        this.instrument = instrumentArray[instrumentID];
        this.trackNumber = trackNumber;

        this.gainNode.connect(masterGainNode);

        // Program Change イベントを送信したか? (Web MIDIのみ)
        this.programChanged = false;
    }
    /**
     * Add a single note to the track
     * @param {Note} The note to add
     */
    addNote(note) {
        //binary search tree seems kind of overkill for now
        for (var i = 0; i < this.notes.length; i++) {
            if (this.notes[i].beat >= note.beat) {
                this.notes.splice(i, 0, note);
                return note;
            }
        }
        this.notes[this.notes.length] = note;
        return note;
    }
    /**
     * Remove the given note
     * @param {Number} noteNumber
     * @param {Number} beat
     * @param {Number} duration
     */
    removeNote(noteNumber, beat, duration, volume) {
        //binary search tree seems kind of overkill for now
        for (var i = 0; i < this.notes.length; i++) {
            //if (this.notes[i].frequency == frequency && this.notes[i].duration == duration && this.notes[i].beat == beat) {
            if (this.notes[i].noteNumber == noteNumber && this.notes[i].beat == beat) {
                this.notes.splice(i, 1);
                return;
            }
        }
    }
    removeAll() {
        this.notes = [];
    }
    /**
     * Play the song
     * may want to add startbeat as an instance variable or something and then have a setter function
     * @param {Number} beat The beat of the song to start at
     */
    play(beat) {
        var startNote;
        if (beat != undefined) {
            startNote = this.findBeatIndex(beat);
            if (startNote == this.notes.length) {
                return;
            }
            //offset = this.notes[startNote].beat - beat;
        }
        else {
            startNote = 0;
            beat = 0;
            //offset = 0;
        }
        /*for (var i = startNote; i < this.notes.length; i++) {
            this.audiolet.scheduler.addRelative(this.notes[i].beat - beat, this.playNote.bind(this, this.notes[i].frequency, this.notes[i].beat, this.notes[i].duration, this.notes[i].volume));
        }*/

        /* Web Audio 用のスケジューラ */
        /*
        let callback = function (e) {
            let beatTime = 60.0 / this.song.tempo;
            const delay = 0.1;
            for (var i = startNote; i < this.notes.length; i++) {
                this.sched.insert(e.playbackTime + delay + beatTime * (this.notes[i].beat - beat), this.playNote.bind(this, this.notes[i].noteNumber, this.notes[i].beat, this.notes[i].duration, this.notes[i].volume));
            }
        }.bind(this);
        this.sched.start(callback);
        */

        // TODO: dont hardcode url
        midiWorker.postMessage({
            instruction: 'start-playing',
            tempo: this.song.tempo,
            notes: this.notes,
            trackNumber: this.trackNumber
        });
    }
    /**
     * Play a note
     * @param {Number} frequency
     * @param {Number} beat
     * @param {Number} duration
     * @param {Number} volume
     */
    playNote(noteNumber, beat, duration, volume, midiNoteNumber) {
        // let note = new Note(noteNumber, beat, duration, volume);
        // let beatTime = 60.0 / this.song.tempo;
        // this.instrument.play(this, note.noteNumber, note.duration * beatTime, note.volume);
        //noteToPlay.connect(this.audiolet.output);
        this.playMidiNote(midiNoteNumber, duration, volume);
    }

    playMidiNote(noteNumber, duration, volume) {
        this.midiProgramChangeIfNeeded();
        const ch = this.trackNumber;
        const velocity = Math.floor(100*volume);
        const noteOn = [0x90 | ch, noteNumber, velocity];
        const noteOff = [0x80 | ch, noteNumber, 0];
        midiWorker.postMessage({
            instruction: 'schedule-now',
            data: noteOn
        });
        midiWorker.postMessage({
            instruction: 'schedule-with-delay',
            data: noteOff,
            delayMillis: duration*1000
        });
    }
    /**
     * Get the index where the Beat should be
     * @param {Number} beat The beat
     */
    findBeatIndex(beat) {
        var i;
        for (i = 0; i < this.notes.length; i++) {
            if (beat <= this.notes[i].beat) {
                return i;
            }
        }
        return i;
    }


    getJSONObject(){
        let jsonobj = {
            instrument: this.instrument.name, //楽器を追加した場合のためにIDでなくNameを用いる
            volume: this.volume,
            notes: [],
        };
        for(let i = 0; i < this.notes.length; i++){
            jsonobj.notes[i] = this.notes[i].getJSONObject();
        }
        return jsonobj;
    }

    loadJSON(json){
        this.loadJSONObject(JSON.parse(json));
    }

    loadJSONObject(jobj){
        this.instrumentID = instrumentNameToID[jobj.instrument];
        this.instrument = instrumentArray[this.instrumentID];
        this.setVolume(jobj.volume);

        this.notes = [];
        for(let i = 0; i < jobj.notes.length; i++){
            this.notes[i] = this.loadNoteJSONObject(jobj.notes[i]);
        }
    }

    loadNoteJSONObject(jobj){
        let note = new Note(0, 0, 0, 0);
        note.noteNumber = jobj.noteNumber;
        note.beat = jobj.beat;
        note.duration = jobj.duration;
        note.volume = jobj.velocity;
        return note;
    }

    setVolume(volume){
        this.volume = volume;
        this.gainNode.gain.value = volume / 127.0;
    }

    midiProgramChangeIfNeeded() {
        if (this.programChanged) return;
        const pc = this.instrument.programChange;
        const data = [0xc0 | this.trackNumber, pc];
        midiWorker.postMessage({
            instruction: 'schedule-now',
            data: data
        });
    }
}


/**
 * A note consists of a frequency, a beat, and a duration
 * @param {Number} frequency
 * @param {Number} beat 
 * @param {Number} duration
 */
class Note {
    constructor(noteNumber, beat, duration, volume) {
        this.noteNumber = noteNumber;
        this.beat = beat;
        this.duration = duration;
        this.volume = volume;
    }
    toString() {
        return "beat: " + this.beat + " duration: " + this.duration;
    }
    getJSONObject(){
        return {
            noteNumber: this.noteNumber,
            beat: this.beat,
            duration: this.duration,
            velocity: this.volume,
        };
    }
}


