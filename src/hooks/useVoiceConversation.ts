/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import { useEffect, useRef, useState } from "react";

interface Options {
  open: boolean;
  busy: boolean;
  onTurn: (text: string) => Promise<void>;
  onNotice: (text: string) => void;
}

// Turn-taking conversation: recognition → existing assistant → spoken reply.
// It never places an order, records audio or sends audio to our server.
export function useVoiceConversation(options: Options) {
  const current = useRef(options);
  current.current = options;
  const enabledRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingRef = useRef(false);
  const speakingRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("Conversación apagada");
  const [transcript, setTranscript] = useState("");

  function stop() {
    enabledRef.current = false;
    setEnabled(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.abort?.();
    }
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
      window.speechSynthesis?.cancel();
    }
    speakingRef.current = false;
    setTranscript("");
    setStatus("Conversación apagada");
  }

  function fail(message: string) {
    stop();
    current.current.onNotice(message);
  }

  function scheduleListening() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(listen, 300);
  }

  function listen() {
    if (
      !enabledRef.current || !current.current.open || current.current.busy ||
      waitingRef.current || speakingRef.current || recognitionRef.current
    ) return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let words = "";
    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = "es-MX";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = function (event: any) {
        words = Array.from(event.results).map(function (result: any) {
          return result[0]?.transcript ?? "";
        }).join(" ").trim();
        setTranscript(words);
      };
      recognition.onerror = function (event: any) {
        fail(event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Permite el micrófono en tu navegador para conversar. También puedes escribir."
          : event.error === "no-speech"
            ? "Pausé la conversación porque no escuché tu voz. Toca Conversar para reanudar."
            : "Se interrumpió el micrófono. Puedes reactivar Conversar o escribir tu mensaje.");
      };
      recognition.onend = function () {
        recognitionRef.current = null;
        if (!enabledRef.current) return;
        if (!words) {
          fail("No escuché un mensaje. Toca Conversar para intentarlo de nuevo.");
          return;
        }
        waitingRef.current = true;
        setStatus("Changui está pensando…");
        setTranscript("");
        void current.current.onTurn(words).finally(function () {
          waitingRef.current = false;
          if (enabledRef.current) scheduleListening();
        });
      };
      setStatus("Te escucho · habla y haz una pausa");
      setTranscript("");
      recognition.start();
    } catch {
      fail("No pude abrir el micrófono. Revisa los permisos o usa el chat escrito.");
    }
  }

  function start() {
    if (enabledRef.current) {
      stop();
      return;
    }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      current.current.onNotice("Este navegador no permite conversación hablada. Puedes escribir o usar el dictado disponible.");
      return;
    }
    enabledRef.current = true;
    setEnabled(true);
    listen();
  }

  function speak(text: string) {
    if (!enabledRef.current || !current.current.open) return;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.abort?.();
    }
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[🐒🛒]/gu, ""));
    utterance.lang = "es-MX";
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(function (voice) { return voice.lang === "es-MX"; }) ??
      voices.find(function (voice) { return voice.lang.startsWith("es"); }) ?? null;
    utterance.rate = 1;
    speakingRef.current = true;
    utteranceRef.current = utterance;
    setStatus("Changui te está hablando…");
    utterance.onend = function () {
      utteranceRef.current = null;
      speakingRef.current = false;
      if (enabledRef.current) scheduleListening();
    };
    utterance.onerror = function () {
      utteranceRef.current = null;
      fail("No pude reproducir la respuesta hablada. Puedes leerla en el chat y continuar escribiendo.");
    };
    window.speechSynthesis.speak(utterance);
  }

  useEffect(function () {
    if (!options.open) stop();
  }, [options.open]);

  useEffect(function () {
    if (options.busy && recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.abort?.();
      setStatus("Changui está pensando…");
    }
    if (!options.busy && enabledRef.current && !speakingRef.current && !waitingRef.current) {
      scheduleListening();
    }
  }, [options.busy]);

  useEffect(function () {
    function onVisibility() { if (document.hidden) stop(); }
    document.addEventListener("visibilitychange", onVisibility);
    return function () {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { enabled, status, transcript, start, stop, speak };
}
