/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import { useEffect, useRef, useState } from "react";

interface Options {
  open: boolean;
  busy: boolean;
  assistantName?: string;
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
  const interruptRecognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingRef = useRef(false);
  const speakingRef = useRef(false);
  const interruptedRef = useRef(false);
  const spokenTextRef = useRef("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("Conversación apagada");
  const [transcript, setTranscript] = useState("");
  function assistantStatus(message: string) {
    return (current.current.assistantName ?? "Changui") + " " + message;
  }

  function normalizarVoz(texto: string) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }

  function quitarEco(texto: string) {
    const palabrasOriginales = texto.trim().split(/\s+/).map(function (original) {
      return { original, normalizadas: normalizarVoz(original).split(" ").filter(Boolean) };
    }).filter(function (palabra) { return palabra.normalizadas.length > 0; });
    const escuchado = palabrasOriginales.flatMap(function (palabra) { return palabra.normalizadas; });
    const locucion = normalizarVoz(spokenTextRef.current).split(" ").filter(Boolean);
    let ecoInicial = 0;
    for (let longitud = 1; longitud <= Math.min(escuchado.length, locucion.length); longitud++) {
      const inicioCoincidente = locucion.some(function (_, indice) {
        return locucion.slice(indice, indice + longitud).join(" ") === escuchado.slice(0, longitud).join(" ");
      });
      if (inicioCoincidente) ecoInicial = longitud;
    }
    return palabrasOriginales.slice(ecoInicial).map(function (palabra) { return palabra.original; }).join(" ").trim();
  }

  function detenerCapturaInterrupcion() {
    const recognition = interruptRecognitionRef.current;
    interruptRecognitionRef.current = null;
    if (!recognition) return;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    recognition.abort?.();
  }

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
    detenerCapturaInterrupcion();
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
      window.speechSynthesis?.cancel();
    }
    speakingRef.current = false;
    interruptedRef.current = false;
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
        setStatus(assistantStatus("está pensando…"));
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

  function escucharInterrupcion() {
    if (
      !enabledRef.current || !current.current.open || !speakingRef.current ||
      interruptRecognitionRef.current || waitingRef.current
    ) return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;
    let words = "";
    try {
      const recognition = new Recognition();
      interruptRecognitionRef.current = recognition;
      recognition.lang = "es-MX";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = function (event: any) {
        const segmentos = Array.from(event.results).map(function (result: any) {
          return quitarEco(result[0]?.transcript ?? "");
        }).filter(Boolean);
        words = segmentos.join(" ").trim();
        if (!words) return;
        setTranscript(words);
        if (!interruptedRef.current) {
          interruptedRef.current = true;
          speakingRef.current = false;
          if (utteranceRef.current) {
            utteranceRef.current.onend = null;
            utteranceRef.current.onerror = null;
            utteranceRef.current = null;
          }
          window.speechSynthesis.cancel();
          setStatus("Te escucho · continúa");
        }
      };
      recognition.onerror = function (event: any) {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setStatus("Puedes interrumpirme tocando el botón o seguir por texto.");
        }
      };
      recognition.onend = function () {
        interruptRecognitionRef.current = null;
        if (!enabledRef.current || !current.current.open) return;
        if (interruptedRef.current && words) {
          waitingRef.current = true;
          setStatus(assistantStatus("está pensando…"));
          setTranscript("");
          void current.current.onTurn(words).finally(function () {
            waitingRef.current = false;
            interruptedRef.current = false;
            if (enabledRef.current) scheduleListening();
          });
          return;
        }
        if (speakingRef.current) {
          setTimeout(escucharInterrupcion, 250);
        } else if (enabledRef.current && !waitingRef.current) {
          interruptedRef.current = false;
          scheduleListening();
        }
      };
      recognition.start();
    } catch {
      interruptRecognitionRef.current = null;
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
    detenerCapturaInterrupcion();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[🐒🛒]/gu, ""));
    utterance.lang = "es-MX";
    const voices = window.speechSynthesis.getVoices();
    const vocesEspanol = voices.filter(function (voice) { return voice.lang.toLowerCase().startsWith("es"); });
    const vozMasculina = vocesEspanol.find(function (voice) {
      return /(mascul|hombre|(?:^|[\s_-])male(?:$|[\s_-])|\bjorge\b|\bdiego\b|\braul\b|\braúl\b|\bcarlos\b|\bpablo\b|\bdaniel\b|\bmateo\b|\bmiguel\b|\bjuan\b|\bandres\b|\bandrés\b|\balejandro\b|\bluis\b)/i.test(voice.name);
    });
    utterance.voice = vozMasculina ??
      vocesEspanol.find(function (voice) { return voice.lang.toLowerCase() === "es-mx"; }) ??
      voices.find(function (voice) { return voice.lang.startsWith("es"); }) ?? null;
    utterance.rate = 0.96;
    utterance.pitch = 0.98;
    speakingRef.current = true;
    interruptedRef.current = false;
    spokenTextRef.current = text;
    utteranceRef.current = utterance;
    setStatus(assistantStatus("te está hablando · puedes interrumpir"));
    utterance.onend = function () {
      utteranceRef.current = null;
      speakingRef.current = false;
      if (!interruptedRef.current) detenerCapturaInterrupcion();
      if (enabledRef.current) {
        setStatus("Te escucho · habla y haz una pausa");
        scheduleListening();
      }
    };
    utterance.onerror = function () {
      utteranceRef.current = null;
      fail("No pude reproducir la respuesta hablada. Puedes leerla en el chat y continuar escribiendo.");
    };
    window.speechSynthesis.speak(utterance);
    setTimeout(escucharInterrupcion, 120);
  }

  function interrupt() {
    if (!speakingRef.current) {
      stop();
      return;
    }
    interruptedRef.current = true;
    speakingRef.current = false;
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    window.speechSynthesis.cancel();
    setStatus("Te escucho · continúa");
    if (!interruptRecognitionRef.current) scheduleListening();
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

  return { enabled, status, transcript, start, stop, speak, interrupt };
}
