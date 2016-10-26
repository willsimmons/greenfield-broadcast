let audioRecorder = {
  set: (v, val) => { audioRecorder[v] = val; },
  get: v => audioRecorder[v],

  wsUri: 'wss://138.197.196.39:8433/kurento', // Kurento secure websocket

  IDLE: 0,
  DISABLED: 1,
  RECORDING: 2,
  state: 0, // start idle

  webRtcPeer: null,
  client: null,
  pipeline: null,

  statusUpdate: null,

  init: statusUpdate => {
    audioRecorder.statusUpdate(statusUpdate);
    audioRecorder.webRtcPeer = null;
    audioRecorder.client = null;
    audioRecorder.pipeline = null;
    audioRecorder.setStatus(audioRecorder.IDLE);
  },

  start: (fileUri, audioInput) => {
    //fileUri = fileUri || 'http://127.0.0.1:7676/repository_servlet/c1el9ntibp5aq7vp568o7bmmgs';

    audioRecorder.setStatus(audioRecorder.DISABLED);

    let options = {
      localVideo: audioInput,
      mediaConstraints: { audio: true, video: false } // audio only
    };

    // FIXME: could use WebRtcPeerSendonly instead but we may want to receive to do a visualizer
    audioRecorder.webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, error => {
      if (error) { return onError(error); }
      this.generateOffer(onStartOffer);
    });
  },

  stop: () => {
    if (webRtcPeer) {
      audioRecorder.webRtcPeer.dispose();
      audioRecorder.webRtcPeer = null;
    }

    if (audioRecorder.pipeline) {
      audioRecorder.pipeline.release();
      audioRecorder.pipeline = null;
    }

    audioRecorder.setStatus(audioRecorder.IDLE);
  },

  setStatus: nextState => {
    if (nextState === audioRecorder.IDLE) {
    } else if (nextState === audioRecorder.RECORDING) {
    } else if (nextState === audioRecorder.DISABLED) {
    }

    // set state and call update function
    audioRecorder.state = nextState;
    audioRecorder.statusUpdate(audioRecorder.state === IDLE ? 'IDLE' :
                               audioRecorder.state === RECORDING ? 'RECORDING' : 'DISABLED');
  },

  setIceCandidateCallbacks: (webRtcPeer, webRtcEp, onerror) => {
    webRtcPeer.on('icecandidate', candidate => {
      console.log('Local candidate:', candidate);
      candidate = kurentoClient.getComplexType('IceCandidate')(candidate);
      webRtcEp.addIceCandidate(candidate, onerror);
    });

    webRtcEp.on('OnIceCandidate', function(event) {
      var candidate = event.candidate;
      console.log('Remote candidate:', candidate);
      webRtcPeer.addIceCandidate(candidate, onerror);
    });
  },

  onStartOffer: (error, sdpOffer) => {
    if (error) { return audioRecorder.onError(error); }

    co(function*() {
      try {
        if (!audioRecorder.client) { audioRecorder.client = yield kurentoClient(audioRecorder.wsUri); }

        // create media pipeline
        audioRecorder.pipeline = yield audioRecorder.client.create('MediaPipeline');

        // create webrtc endpoint
        var webRtc = yield audioRecorder.pipeline.create('WebRtcEndpoint');
        audioRecorder.setIceCandidateCallbacks(audioRecorder.webRtcPeer, webRtc, onError);

        // create recorder pointing to our recording url
        var recorder = yield audioRecorder.pipeline.create('RecorderEndpoint', { uri: fileUri });

        // connect
        yield webRtc.connect(recorder);
        yield webRtc.connect(webRtc);

        // start recorder
        yield recorder.record();

        var sdpAnswer = yield webRtc.processOffer(sdpOffer);
        webRtc.gatherCandidates(onError);
        audioRecorder.webRtcPeer.processAnswer(sdpAnswer);

        audioRecorder.setStatus(audioRecorder.RECORDING);

      } catch (e) {
        audioRecorder.onError(e);
      }
    })();
  },

  onError: error => {
    if (error) {
      console.error(error);
      audioRecorder.stop();
    }
  }
};

export default audioRecorder;