"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};


function cleanTextForSpeech(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " code block omitted ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[|*_~`#<>={}\[\]\\]/g, " ")
    .replace(/[•▪◦►◆★☆✓✔✗✘➡⬅⬆⬇🔹🔸🔻🔺]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function looksLikeDesktopCommand(input: string): boolean {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[!?.,]+$/g, "");

  const prefix = "^(?:(?:hey nexus|nexus)[, ]*)?(?:(?:please|can you|could you|would you|kindly)\\s+)*";
  const actions =
    "(?:open|launch|start|run|close|quit|exit|kill|play|pause|resume|stop|mute|unmute|skip|next|previous|restart|shutdown|lock|unlock|show|hide|search youtube for|find and play|turn up|turn down|increase|decrease)\\b";

  return new RegExp(prefix + actions, "i").test(normalized);
}

function NexusMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M5 5h14v14H5z" />
      <path d="M9 9h6v6H9z" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const {
    transcript,
    interimTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  const [userEmail, setUserEmail] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [voiceAssistantEnabled, setVoiceAssistantEnabled] =
    useState(false);

  const [wakeActive, setWakeActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const voiceEnabledRef = useRef(false);
  const loadingRef = useRef(false);
  const speakingRef = useRef(false);

  const autoSendTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingVoiceCommandRef = useRef("");

  /*
   * Keep refs synchronized with state.
   */
  useEffect(() => {
    voiceEnabledRef.current = voiceAssistantEnabled;
  }, [voiceAssistantEnabled]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    speakingRef.current = isSpeaking;
  }, [isSpeaking]);


  /*
   * Check Supabase session.
   */
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setUserEmail(session.user.email ?? "");
      setCheckingSession(false);
    };

    checkUser();
  }, [router]);

  /*
   * Auto-scroll chat.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  /*
   * Start continuous microphone listening.
   */
  const startContinuousListening = useCallback(async () => {
    if (!browserSupportsSpeechRecognition) {
      return;
    }

    if (!voiceEnabledRef.current) {
      return;
    }

    if (loadingRef.current || speakingRef.current) {
      return;
    }

    try {
      await SpeechRecognition.startListening({
        continuous: true,
        language: "en-US",
      });
    } catch (error) {
      console.error("Speech recognition start error:", error);
    }
  }, [browserSupportsSpeechRecognition]);

  /*
   * Speak Nexus response.
   */
  const speakResponse = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        return;
      }

      SpeechRecognition.stopListening();

      speakingRef.current = true;
      setIsSpeaking(true);

      window.speechSynthesis.cancel();

      const spokenText = cleanTextForSpeech(text);
      if (!spokenText) {
        speakingRef.current = false;
        setIsSpeaking(false);
        if (voiceEnabledRef.current) {
          setTimeout(() => startContinuousListening(), 250);
        }
        return;
      }

      const speech = new SpeechSynthesisUtterance(spokenText);

      const voices = window.speechSynthesis.getVoices();

      const preferredVoice =
        voices.find((voice) =>
          voice.name.includes("Microsoft George")
        ) ||
        voices.find((voice) =>
          voice.name.includes("Google UK English Male")
        ) ||
        voices.find((voice) =>
          voice.name.includes("Google US English")
        );

      if (preferredVoice) {
        speech.voice = preferredVoice;
      }

      speech.rate = 0.95;
      speech.pitch = 0.7;
      speech.volume = 1;

      const finishSpeaking = () => {
        speakingRef.current = false;
        setIsSpeaking(false);

        resetTranscript();
        // Keep conversation mode active after Nexus finishes speaking.
        // The user should not need to repeat the wake phrase every turn.

        if (voiceEnabledRef.current) {
          setTimeout(() => {
            startContinuousListening();
          }, 250);
        }
      };

      speech.onend = finishSpeaking;
      speech.onerror = finishSpeaking;

      setTimeout(() => {
        window.speechSynthesis.speak(speech);
      }, 80);
    },
    [resetTranscript, startContinuousListening]
  );


  /*
   * Send a message to FastAPI.
   *
   * voiceRequest tells Nexus whether it should speak
   * the response aloud.
   */
  const sendText = useCallback(
    async (
      text: string,
      voiceRequest = false
    ) => {
      const cleanedInput = text.trim();

      if (!cleanedInput || loadingRef.current) {
        return;
      }


      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }

      pendingVoiceCommandRef.current = "";

      SpeechRecognition.stopListening();

      resetTranscript();
      // Do not clear wakeActive here: it represents the ongoing conversation session.

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: cleanedInput,
      };

      setMessages((current) => [
        ...current,
        userMessage,
      ]);

      setInput("");

      loadingRef.current = true;
      setLoading(true);

      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_NEXUS_API_URL?.replace(/\/$/, "") ||
          "http://127.0.0.1:8000";

        let desktopResult: { handled?: boolean; reply?: string } | null = null;

        // Only desktop-style requests are sent to the remote control endpoint.
        // The backend verifies the signed-in Supabase user and routes commands only to that account’s paired devices.
        if (looksLikeDesktopCommand(cleanedInput)) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
              throw new Error("Your Nexus AI session has expired. Please sign in again.");
            }

            const desktopResponse = await fetch(
              `${apiBaseUrl}/v2/desktop/command`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ command: cleanedInput }),
                signal: AbortSignal.timeout(23000),
              }
            );

            const responseData = await desktopResponse.json().catch(() => ({}));

            if (!desktopResponse.ok) {
              const detail =
                typeof responseData.detail === "string"
                  ? responseData.detail
                  : "Nexus could not authorize or complete that desktop command.";

              // Do not silently turn authorization/configuration errors into AI chat.
              desktopResult = {
                handled: true,
                reply: detail,
              };
            } else {
              desktopResult = responseData;
            }
          } catch (desktopError) {
            console.error("Secure Nexus desktop command failed:", desktopError);

            // Fail closed: never bypass account pairing through a localhost agent.
            desktopResult = {
              handled: true,
              reply: "I could not reach the secure desktop relay. Check that this computer is paired to your Nexus account and that the desktop agent is running.",
            };
          }
        }

        if (desktopResult?.handled) {
          const assistantMessage: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: desktopResult.reply || "The desktop command was processed.",
          };

          setMessages((current) => [...current, assistantMessage]);
          loadingRef.current = false;
          setLoading(false);

          if (voiceRequest && voiceEnabledRef.current) {
            speakResponse(assistantMessage.content);
          } else if (voiceEnabledRef.current) {
            setTimeout(() => startContinuousListening(), 250);
          }
          return;
        }

        // Not a desktop command: use the existing Gemini chat backend unchanged.
        const response = await fetch(
          `${apiBaseUrl}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: cleanedInput,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(
            "The Nexus AI backend returned an error."
          );
        }

        const data = await response.json();

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            data.reply ||
            "I could not generate a response.",
        };

        setMessages((current) => [
          ...current,
          assistantMessage,
        ]);

        loadingRef.current = false;
        setLoading(false);

        if (
          voiceRequest &&
          voiceEnabledRef.current
        ) {
          speakResponse(
            assistantMessage.content
          );
        } else if (
          voiceEnabledRef.current
        ) {
          setTimeout(() => {
            startContinuousListening();
          }, 250);
        }
      } catch (error) {
        console.error(error);

        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I could not connect to the Nexus AI backend. Make sure the Python server is running.",
        };

        setMessages((current) => [
          ...current,
          errorMessage,
        ]);

        loadingRef.current = false;
        setLoading(false);

        if (voiceEnabledRef.current) {
          setTimeout(() => {
            startContinuousListening();
          }, 300);
        }
      }
    },
    [
      resetTranscript,
      speakResponse,
      startContinuousListening,
    ]
  );

  /*
   * Normal typed-message form submission.
   */
  const sendMessage = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    await sendText(input, false);
  };

  /*
   * Schedule voice command after user stops speaking.
   */
  const scheduleVoiceSend = useCallback(
    (command: string) => {
      const cleanedCommand = command.trim();

      if (!cleanedCommand) {
        return;
      }

      pendingVoiceCommandRef.current =
        cleanedCommand;

      setInput(cleanedCommand);

      if (autoSendTimerRef.current) {
        clearTimeout(
          autoSendTimerRef.current
        );
      }

      autoSendTimerRef.current =
        setTimeout(() => {
          const commandToSend =
            pendingVoiceCommandRef.current.trim();

          if (
            commandToSend &&
            voiceEnabledRef.current &&
            !loadingRef.current &&
            !speakingRef.current
          ) {
            sendText(
              commandToSend,
              true
            );
          }
        }, 1300);
    },
    [sendText]
  );

  /*
   * Voice conversation mode.
   * Say "Hey Nexus" once to enter conversation mode. After that, commands
   * are accepted without repeating the wake phrase until the user asks Nexus
   * to sleep or turns the Voice Assistant off.
   */
  useEffect(() => {
    if (!voiceAssistantEnabled) {
      return;
    }

    // Use interim recognition while waiting for the wake phrase. Some browsers
    // do not finalize a short phrase such as "Hey Nexus" promptly.
    // Once conversation mode is active, use finalized transcript only so we
    // do not submit partial desktop commands.
    const availableSpeech = wakeActive
      ? transcript.trim()
      : (transcript.trim() || interimTranscript.trim());

    if (
      loading ||
      isSpeaking ||
      !availableSpeech
    ) {
      return;
    }

    const spokenText = availableSpeech;
    let normalizedText = spokenText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Speech recognition commonly mishears "Nexus" as "Nexis" or
    // splits it into "next us/next is". Normalize these common variants
    // before matching so users do not have to repeat the wake phrase.
    normalizedText = normalizedText
      .replace(/\bhey\s+(?:nexis|nexas|next us|next is|neck sis)\b/g, "hey nexus")
      .replace(/\bhi\s+nexus\b/g, "hey nexus")
      .replace(/\bhay\s+nexus\b/g, "hey nexus");

    const wakeWord = "hey nexus";
    const sleepPhrases = [
      "goodbye nexus",
      "good night nexus",
      "go to sleep",
      "nexus go to sleep",
      "sleep nexus",
      "stop listening",
      "end conversation",
    ];

    if (!wakeActive) {
      const wakeIndex = normalizedText.lastIndexOf(wakeWord);

      if (wakeIndex === -1) {
        return;
      }

      const commandAfterWakeWord = normalizedText
        .slice(wakeIndex + wakeWord.length)
        .trim();

      setWakeActive(true);
      resetTranscript();

      if (commandAfterWakeWord) {
        scheduleVoiceSend(commandAfterWakeWord);
      }

      return;
    }

    // In active conversation mode, a sleep phrase returns Nexus to wake-word
    // standby. It does not get sent to Gemini as an ordinary chat message.
    const shouldSleep = sleepPhrases.some((phrase) =>
      normalizedText.includes(phrase)
    );

    if (shouldSleep) {
      if (autoSendTimerRef.current) {
        clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = null;
      }

      pendingVoiceCommandRef.current = "";
      setInput("");
      setWakeActive(false);
      resetTranscript();
      speakResponse("Going to sleep. Say Hey Nexus when you need me again.");
      return;
    }


    // Wake phrase is no longer required for each command.
    scheduleVoiceSend(normalizedText);
  }, [
    transcript,
    interimTranscript,
    voiceAssistantEnabled,
    wakeActive,
    loading,
    isSpeaking,
    resetTranscript,
    scheduleVoiceSend,
    speakResponse,
  ]);

  /*
   * Recover continuous listening if Chrome stops
   * recognition because of inactivity.
   */
  useEffect(() => {
    if (
      !voiceAssistantEnabled ||
      listening ||
      loading ||
      isSpeaking
    ) {
      return;
    }

    const restartTimer = setTimeout(() => {
      startContinuousListening();
    }, 700);

    return () =>
      clearTimeout(restartTimer);
  }, [
    voiceAssistantEnabled,
    listening,
    loading,
    isSpeaking,
    startContinuousListening,
  ]);

  /*
   * Toggle voice assistant.
   *
   * No voice announcement.
   */
  const toggleVoiceAssistant =
    async () => {
      if (
        !browserSupportsSpeechRecognition
      ) {
        alert(
          "Voice recognition is not supported in this browser. Please use Google Chrome."
        );
        return;
      }

      const nextState =
        !voiceEnabledRef.current;

      voiceEnabledRef.current =
        nextState;

      setVoiceAssistantEnabled(
        nextState
      );

      setWakeActive(false);
      resetTranscript();
      setInput("");

      if (autoSendTimerRef.current) {
        clearTimeout(
          autoSendTimerRef.current
        );

        autoSendTimerRef.current = null;
      }

      if (nextState) {
        /*
         * Browser requires this initial click
         * to grant microphone access.
         *
         * After this, "Hey Nexus" is automatic
         * during the session.
         */
        await SpeechRecognition.startListening({
          continuous: true,
          language: "en-US",
        });
      } else {
        SpeechRecognition.stopListening();

        window.speechSynthesis?.cancel();

        speakingRef.current = false;
        setIsSpeaking(false);
      }
    };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    SpeechRecognition.stopListening();
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    window.speechSynthesis?.cancel();

    await supabase.auth.signOut();

    router.push("/login");
  };

  const startNewConversation = () => {
    setMobileMenuOpen(false);
    setMessages([]);
    setInput("");

    resetTranscript();
    // Starting a fresh chat does not end the active voice conversation.
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090909] text-white">
        <p className="text-sm text-zinc-500">
          Loading Nexus AI...
        </p>
      </main>
    );
  }

  const voiceStatus = (() => {
    if (!voiceAssistantEnabled) {
      return "Voice assistant off";
    }

    if (!isMicrophoneAvailable) {
      return "Microphone access blocked";
    }

    if (isSpeaking) {
      return "Speaking";
    }

    if (loading) {
      return "Thinking";
    }

    if (listening && wakeActive) {
      return "Conversation mode — listening";
    }

    if (listening) {
      return 'Waiting for "Hey Nexus"';
    }

    return "Starting microphone";
  })();

  return (
    <main className="relative flex h-[100dvh] min-h-0 overflow-hidden bg-[#090909] text-white">
      {/* MOBILE NAVIGATION OVERLAY */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/* MOBILE SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(84vw,300px)] flex-col border-r border-white/10 bg-[#0d0d0d] transition-transform duration-200 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e4e5da] text-[#151612]"><NexusMark className="h-4 w-4" /></div>
            <div>
              <p className="font-semibold tracking-tight">Nexus AI</p>
              <p className="text-xs text-zinc-500">Intelligent workspace</p>
            </div>
          </div>
          <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="rounded-lg px-3 py-2 text-xl text-zinc-400 hover:bg-white/5">×</button>
        </div>
        <div className="flex-1 px-4 py-5">
          <button onClick={startNewConversation} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5">＋ New conversation</button>
          <p className="mt-8 px-3 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">Workspace</p>
          <div className="mt-3 space-y-1">
            <button onClick={() => setMobileMenuOpen(false)} className="w-full rounded-xl bg-white/5 px-3 py-3 text-left text-sm text-zinc-200">AI Assistant</button>
            <button type="button" onClick={() => setMobileMenuOpen(false)} className="w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-500 hover:bg-white/5">Documents</button>
            <button type="button" onClick={() => setMobileMenuOpen(false)} className="w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-500 hover:bg-white/5">Automations</button>
            <Link href="/dashboard/devices" onClick={() => setMobileMenuOpen(false)} className="block w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Desktop devices</Link>
          </div>
        </div>
        <div className="border-t border-white/10 p-4">
          <p className="mb-1 truncate px-3 text-sm text-zinc-300">{userEmail}</p>
          <p className="mb-3 px-3 text-xs text-zinc-600">Nexus AI account</p>
          <button onClick={handleLogout} className="min-h-11 w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Sign out</button>
        </div>
      </aside>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-[#0d0d0d] md:flex md:flex-col">
        <div className="border-b border-white/10 px-6 py-6">
          <button
            onClick={startNewConversation}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e4e5da] text-[#151612]">
              <NexusMark className="h-4 w-4" />
            </div>

            <div>
              <p className="font-semibold tracking-tight">
                Nexus AI
              </p>

              <p className="text-xs text-zinc-500">
                Intelligent workspace
              </p>
            </div>
          </button>
        </div>

        <div className="flex-1 px-4 py-5">
          <button
            onClick={startNewConversation}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            <span className="text-lg">
              +
            </span>

            New conversation
          </button>

          <div className="mt-8">
            <p className="px-3 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
              Workspace
            </p>

            <div className="mt-3 space-y-1">
              <button className="w-full rounded-xl bg-white/5 px-3 py-3 text-left text-sm text-zinc-300">
                AI Assistant
              </button>

              <button className="w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300">
                Documents
              </button>

              <button className="w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300">
                Automations
              </button>

              <Link href="/dashboard/devices" className="block w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
                Desktop devices
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 px-3">
            <p className="truncate text-sm text-zinc-300">
              {userEmail}
            </p>

            <p className="mt-1 text-xs text-zinc-600">
              Nexus AI account
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full rounded-xl px-3 py-3 text-left text-sm text-zinc-500 transition hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* HEADER */}
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 sm:px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-lg text-zinc-300 hover:bg-white/5 md:hidden"
            >
              ☰
            </button>
            <div className="min-w-0">
            <h1 className="text-sm font-medium">
              Nexus Assistant
            </h1>

              <p className="text-xs text-zinc-600">
                Powered by Nexus AI
              </p>
            </div>
          </div>

          <div className="flex max-w-[52%] items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                voiceAssistantEnabled
                  ? "bg-emerald-400"
                  : "bg-zinc-600"
              }`}
            />

            <span className="truncate text-[11px] text-zinc-500 sm:text-xs">
              {voiceStatus}
            </span>
          </div>
        </header>

        {/* CHAT */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center justify-center px-4 py-8 text-center sm:px-6 sm:py-12">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-[#191a17] text-[#b8c9a8] sm:mb-6 sm:h-14 sm:w-14">
                <NexusMark className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>

              <p className="mb-3 text-sm uppercase tracking-[0.22em] text-zinc-600">
                Nexus AI
              </p>

              <h2 className="max-w-2xl text-2xl font-medium tracking-[-0.04em] sm:text-3xl md:text-4xl">
                What can I help you
                accomplish?
              </h2>

              <p className="mt-5 max-w-xl leading-7 text-zinc-500">
                Type normally or enable
                the voice assistant and
                say &quot;Hey Nexus&quot;.
              </p>

              <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-2">
                <button
                  onClick={() =>
                    setInput(
                      "Explain artificial intelligence in simple terms."
                    )
                  }
                  className="rounded-2xl border border-white/10 p-4 text-left transition hover:bg-white/[0.04]"
                >
                  <p className="text-sm font-medium">
                    Explain a concept
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    Learn something in
                    simple terms
                  </p>
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "Help me organize my research project."
                    )
                  }
                  className="rounded-2xl border border-white/10 p-4 text-left transition hover:bg-white/[0.04]"
                >
                  <p className="text-sm font-medium">
                    Research assistance
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    Structure ideas and
                    information
                  </p>
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "Write a professional project summary."
                    )
                  }
                  className="rounded-2xl border border-white/10 p-4 text-left transition hover:bg-white/[0.04]"
                >
                  <p className="text-sm font-medium">
                    Create content
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    Draft and improve your
                    writing
                  </p>
                </button>

                <button
                  onClick={() =>
                    setInput(
                      "What kinds of tasks can an AI automation assistant perform?"
                    )
                  }
                  className="rounded-2xl border border-white/10 p-4 text-left transition hover:bg-white/[0.04]"
                >
                  <p className="text-sm font-medium">
                    Explore automation
                  </p>

                  <p className="mt-1 text-xs text-zinc-600">
                    Discover possible
                    computer tasks
                  </p>
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-5 sm:py-8 md:px-8">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-8 flex ${
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[85%] rounded-3xl bg-white px-5 py-4 text-sm leading-7 text-black md:max-w-[70%]"
                        : "max-w-[90%] text-sm leading-7 text-zinc-200 md:max-w-[80%]"
                    }
                  >
                    {message.role ===
                      "assistant" && (
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-[#191a17] text-[#b8c9a8]">
                          <NexusMark className="h-3.5 w-3.5" />
                        </div>

                        <span className="text-xs font-medium text-zinc-500">
                          Nexus AI
                        </span>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="mb-8 flex justify-start">
                  <div className="flex items-center gap-3 text-sm text-zinc-500">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-[#191a17] text-[#b8c9a8]">
                      <NexusMark className="h-3.5 w-3.5" />
                    </div>

                    Nexus AI is
                    thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>


        {/* INPUT */}
        <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 md:px-8 md:pb-7">
          <form
            onSubmit={sendMessage}
            className="mx-auto max-w-4xl"
          >
            {voiceAssistantEnabled && (
              <div className="mb-3 flex items-center justify-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    isSpeaking
                      ? "bg-blue-400"
                      : wakeActive
                        ? "animate-pulse bg-red-500"
                        : listening
                          ? "animate-pulse bg-emerald-400"
                          : "bg-zinc-600"
                  }`}
                />

                <p className="text-xs text-zinc-500">
                  {voiceStatus}
                </p>
              </div>
            )}

            <div className="rounded-[20px] border border-white/10 bg-[#151515] p-2 shadow-2xl shadow-black/30 sm:rounded-[24px]">
              <textarea
                value={input}
                onChange={(event) =>
                  setInput(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();

                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder={
                  wakeActive
                    ? "Conversation mode is active..."
                    : "Ask Nexus AI anything..."
                }
                className="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-3 py-3 text-base text-white outline-none placeholder:text-zinc-600 sm:min-h-[56px] sm:px-4 sm:py-4 sm:text-sm"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 sm:px-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    className="min-h-10 rounded-xl px-2 py-2 text-xs text-zinc-500 transition hover:bg-white/5 hover:text-white sm:px-3"
                  >
                    + File
                  </button>

                  <button
                    type="button"
                    onClick={
                      toggleVoiceAssistant
                    }
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
                      voiceAssistantEnabled
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "text-zinc-500 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>
                      {voiceAssistantEnabled
                        ? "🎙️"
                        : "🎤"}
                    </span>

                    <span>
                      Voice Assistant
                    </span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={
                    !input.trim() ||
                    loading
                  }
                  className="min-h-10 shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30 sm:px-5"
                >
                  {loading
                    ? "Thinking"
                    : "Send"}
                </button>
              </div>
            </div>

            {!browserSupportsSpeechRecognition && (
              <p className="mt-3 text-center text-xs text-amber-500">
                Voice recognition is not
                supported by this browser.
                Please use Google Chrome.
              </p>
            )}

            <p className="mt-3 text-center text-[11px] text-zinc-700">
              Nexus AI can make mistakes.
              Verify important information.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}