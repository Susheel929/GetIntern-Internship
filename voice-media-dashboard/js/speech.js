/* ===========================================================
   SPEECH
   Native Web Speech Recognition API binding. No third-party
   voice SDK — this wraps window.SpeechRecognition /
   webkitSpeechRecognition directly.
   =========================================================== */

const Speech = (() => {
  let recognition = null;
  let isListening = false;
  let onResultCallback = null;
  let onStateChangeCallback = null;

  function isSupported() {
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  }

  function init({ onResult, onStateChange }) {
    onResultCallback = onResult;
    onStateChangeCallback = onStateChange;

    if (!isSupported()) {
      Logger.log("Web Speech Recognition API not supported in this browser.", "warn");
      return false;
    }

    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognitionImpl();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      onStateChangeCallback?.("listening");
    };

    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      onResultCallback?.(transcript, isFinal);
    };

    recognition.onerror = (event) => {
      isListening = false;
      const messages = {
        "no-speech": "No speech detected. Try again.",
        "audio-capture": "No microphone found.",
        "not-allowed": "Microphone access denied. Check browser permissions.",
        "network": "Speech recognition network error.",
      };
      const msg = messages[event.error] || `Speech recognition error: ${event.error}`;
      Logger.log(msg, "err");
      onStateChangeCallback?.("error", msg);
    };

    recognition.onend = () => {
      isListening = false;
      onStateChangeCallback?.("idle");
    };

    return true;
  }

  function start() {
    if (!recognition) return;
    try {
      recognition.start();
    } catch (err) {
      // start() throws if already started — swallow defensively,
      // this is a known DOM quirk, not an app-level failure.
      Logger.log(`Could not start recognition: ${err.message}`, "err");
    }
  }

  function stop() {
    if (!recognition) return;
    recognition.stop();
  }

  function toggle() {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }

  /**
   * Parses a finalized transcript into a structured command.
   * Every extracted argument is passed through sanitizeAndValidate()
   * before being trusted — voice input is still untrusted input.
   * Returns { type, payload } or { type: "unknown", raw }.
   */
  function parseCommand(transcript) {
    const text = transcript.trim().toLowerCase();

    const newsMatch = text.match(/(?:search |find )?news (?:for |about |on )?(.+)/i);
    if (newsMatch) {
      const topic = sanitizeAndValidate(newsMatch[1], "SAFE_QUERY");
      return topic ? { type: "news", payload: topic } : { type: "invalid", raw: transcript };
    }

    const weatherMatch = text.match(/weather (?:in |for )?(.+)/i);
    if (weatherMatch) {
      const city = sanitizeAndValidate(weatherMatch[1], "CITY_NAME");
      return city ? { type: "weather", payload: city } : { type: "invalid", raw: transcript };
    }

    if (/\bshow space\b|\bspace\b|\bapod\b|\bastronomy\b/.test(text)) {
      return { type: "space", payload: null };
    }

    if (/\bclear\b|\breset\b/.test(text)) {
      return { type: "clear", payload: null };
    }

    return { type: "unknown", raw: transcript };
  }

  return { isSupported, init, start, stop, toggle, parseCommand, get isListening() { return isListening; } };
})();
