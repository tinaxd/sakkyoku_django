importScripts("WebMIDIPlayer.js");

let sched = null;

onmessage = function(e) {
    if (e.ports && e.ports.length) {
        const port = e.ports[0];
        console.log("WebMIDIWorker: received MessageChannel port");
        sched = new WebMIDIScheduler(500, port);
        return;
    }

    e = e.data;
    console.log(e);
    switch (e.instruction) {
    case 'start-playing':
        startPlaying(e);
        break;
    case 'schedule-now':
        scheduleNow(e);
        break;
    case 'schedule-with-delay':
        scheduleWithDelay(e);
        break;
    }
}

function startPlaying(e) {
    /* Web MIDI 用のスケジューラ */
    const notes = e.notes;
    const tempo = e.tempo;
    const trackNumber = e.trackNumber;
    const startNote = e.startNote;
    const beat = e.beat;

    sched.stop();

    const scheduledNotes = []; // ノートがスケジューリングされたか否か
    for (let i=0; i<notes.length; i++) {
        scheduledNotes.push(false);
    }
    const callback = function (proxy) {
        const beatTime = 60.0 / tempo;
        const requestedDuration = proxy.requestDuration;
        const playbackTime = proxy.playbackTime;
        for (let i=startNote; i<notes.length; i++) {
            // プレイバック開始からノート開始までの実時間 (millis)
            const absoluteTime = beatTime * (notes[i].beat - beat) * 1000;
            if (absoluteTime < playbackTime) {
                // まだ再生位置に達していない
                continue;
            } else if (absoluteTime > playbackTime + requestedDuration) {
                // 今要求されている時間外のノートに到達したので終了する
                break;
            } else if (scheduledNotes[i]) {
                // 二重にスケジューリングされないようにする
                continue;
            }

            // 実時間のノートの長さ (millis)
            const absoluteDuration = beatTime * notes[i].duration * 1000;
            // MIDI チャンネル
            const ch = trackNumber;
            // MIDI イベント
            const noteOn = [0x90 | ch, notes[i].noteNumber, notes[i].volume];
            const noteOff = [0x80 | ch, notes[i].noteNumber, 0];
            // スケジューリング
            const onDelay = absoluteTime-playbackTime;
            const offDelay = absoluteTime+absoluteDuration-playbackTime;
            proxy.scheduleWithDelay(noteOn, onDelay);
            proxy.scheduleWithDelay(noteOff, offDelay);
            // スケジューリングされたとしてフラグをつける
            scheduledNotes[i] = true;
        }
    }.bind(this);
    sched.start(callback);
}

function scheduleNow(e) {
    const data = e.data;
    sched.scheduleNow(data);
}

function scheduleWithDelay(e) {
    const data = e.data;
    const delayMillis = e.delayMillis;
    sched.scheduleNowWithDelay(data, delayMillis);
}