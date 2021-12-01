const DOWNLOAD_URL = "api/songs/";

class SongLoader {
    requestSong(song_id){
        $.ajax(
            {
                url: DOWNLOAD_URL + song_id,
                type:'GET',
                //data: "song_id="+song_id,
                data: "",
                cache: false,
                error:function(){},
                complete:this.processResponse.bind(this),
            }
        );
    }

    processResponse(response){
        let res = response.responseText;

        if(res.charAt(0) == "!"){   //error
            alert(res.substring(1));
            return;
        }
        if(res.charAt(0) != "{"){   //not json
            alert("Invalid response: " + res);
            return;
        }

        let json = JSON.parse(res);

        sequencer.userID = json.userID;
        sequencer.setMode(json.isMySong);

        let song = new Song();
        song.loadJSONObject(json.song);
        sequencer.setSong(song);
    }
}

var songLoader = new SongLoader();