// ai_voice.js — "Nexus Ava" voice widget.
// Bridges the browser's Web Speech API (speech -> text -> speech) to the
// FastAPI backend, which turns the transcript into an intent + DB lookup.
import { api } from "./api.js";

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

function getElements() {
  return {
    widget: document.getElementById("ai-widget"),
    launcher: document.getElementById("ai-launcher"),
    closeBtn: document.getElementById("ai-widget-close"),
    micBtn: document.getElementById("ai-widget-mic"),
    status: document.getElementById("ai-widget-status"),
    hint: document.getElementById("ai-widget-hint"),
    quickActions: document.querySelectorAll(".ai-widget__quick-action"),
  };
}

function setListeningUI(widget, status, listening) {
  widget.classList.toggle("is-listening", listening);
  status.textContent = listening ? "Ava is Listening..." : "Tap the mic to talk to Ava";
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

async function handleTranscript(transcript, els) {
  els.hint.textContent = `You said: "${transcript}"`;
  try {
    const result = await api.sendVoiceCommand(transcript);
    els.status.textContent = result.reply_text;
    speak(result.reply_text);
    applySideEffects(result);
  } catch (err) {
    els.status.textContent = "Sorry, something went wrong reaching the server.";
    console.error(err);
  }
}

// Update the rest of the UI based on what the assistant understood,
// e.g. filter a table or navigate to a module. Extend this as more
// modules (CRM/ERP pages) come online.
function applySideEffects(result) {
  if (result.intent === "top_leads" && result.data?.leads) {
    document.dispatchEvent(new CustomEvent("ava:top-leads", { detail: result.data.leads }));
  }
  if (result.intent === "check_inventory" && result.data) {
    document.dispatchEvent(new CustomEvent("ava:inventory-result", { detail: result.data }));
  }
}

function initRecognition(els) {
  if (!SpeechRecognitionImpl) {
    els.status.textContent = "Voice recognition isn't supported in this browser.";
    els.micBtn.disabled = true;
    return;
  }

  recognition = new SpeechRecognitionImpl();
  recognition.lang = "en-US"; // switch to "ar-SA" for Arabic recognition
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    setListeningUI(els.widget, els.status, true);
  };

  recognition.onend = () => {
    isListening = false;
    setListeningUI(els.widget, els.status, false);
  };

  recognition.onerror = (event) => {
    isListening = false;
    setListeningUI(els.widget, els.status, false);
    els.status.textContent = `Mic error: ${event.error}`;
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    handleTranscript(transcript, els);
  };
}

function toggleListening() {
  if (!recognition) return;
  if (isListening) {
    recognition.stop();
  } else {
    recognition.start();
  }
}

export function initAiWidget() {
  const els = getElements();
  if (!els.widget) return;

  initRecognition(els);

  els.micBtn.addEventListener("click", toggleListening);

  els.closeBtn.addEventListener("click", () => {
    els.widget.classList.add("is-collapsed");
    els.launcher.classList.remove("is-hidden");
  });

  els.launcher.addEventListener("click", () => {
    els.widget.classList.remove("is-collapsed");
    els.launcher.classList.add("is-hidden");
  });

  els.quickActions.forEach((btn) => {
    btn.addEventListener("click", () => handleTranscript(btn.dataset.command, els));
  });
}
