import React from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

/** Listens once and hands back what the phone's speech recogniser heard. */
export const useVoice = () => {
  const [listening, setListening] = React.useState(false);

  const listen = React.useCallback(async (): Promise<string[]> => {
    if (!Capacitor.isNativePlatform()) throw new Error("Voice works in the Android app.");
    const { available } = await SpeechRecognition.available();
    if (!available) throw new Error("Speech recognition isn't available on this phone.");

    let { speechRecognition } = await SpeechRecognition.checkPermissions();
    if (speechRecognition !== "granted") {
      ({ speechRecognition } = await SpeechRecognition.requestPermissions());
    }
    if (speechRecognition !== "granted") throw new Error("Allow microphone access to use voice.");

    setListening(true);
    try {
      // Resolves once you stop talking, with the recogniser's best guesses.
      const { matches } = await SpeechRecognition.start({
        language: "en-IN",
        maxResults: 5,
        popup: false,
        partialResults: false,
      });
      return matches ?? [];
    } finally {
      setListening(false);
    }
  }, []);

  const cancel = React.useCallback(async () => {
    setListening(false);
    if (Capacitor.isNativePlatform()) await SpeechRecognition.stop().catch(() => undefined);
  }, []);

  return { listening, listen, cancel };
};
