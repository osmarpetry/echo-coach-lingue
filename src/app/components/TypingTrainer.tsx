import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Settings, Play, Pause, Square, SkipBack, SkipForward, Volume2, Edit3, Check, Type, Repeat } from 'lucide-react';
import { TTSSettings } from '../App';
import MarkdownLine from './MarkdownLine';

interface TypingTrainerProps {
  sourceText: string;
  ttsSettings: TTSSettings;
  onRestart: () => void;
  onSettingsOpen: () => void;
  onSourceTextChange?: (text: string) => void;
}

interface Line {
  text: string;
  index: number;
}

interface TypingState {
  currentLineIndex: number;
  caretIndex: number;
  correctChars: Set<number>;
  errorChars: Set<number>;
  lastSpokenWord: string;
  wordsTyped: number;
  errors: number;
  totalCharsTyped: number;
}

type SoundType = 'key' | 'error' | 'wordComplete' | 'lineComplete' | 'click';

export default function TypingTrainer({
  sourceText,
  ttsSettings,
  onRestart,
  onSettingsOpen,
  onSourceTextChange,
}: TypingTrainerProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [typingState, setTypingState] = useState<TypingState>({
    currentLineIndex: 0,
    caretIndex: 0,
    correctChars: new Set(),
    errorChars: new Set(),
    lastSpokenWord: '',
    wordsTyped: 0,
    errors: 0,
    totalCharsTyped: 0,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editText, setEditText] = useState(sourceText);
  const [loopInactivityEnabled, setLoopInactivityEnabled] = useState(() => {
    const saved = localStorage.getItem('loopInactivityEnabled');
    return saved ? saved === 'true' : true;
  });

  const activeLineRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const loopCountRef = useRef(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopAbortRef = useRef(false);
  const loopTextRef = useRef('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const loopInactivityEnabledRef = useRef(loopInactivityEnabled);

  // Refs for stable callback access
  const typingStateRef = useRef(typingState);
  const linesRef = useRef(lines);
  const ttsSettingsRef = useRef(ttsSettings);
  const isEditModeRef = useRef(isEditMode);

  typingStateRef.current = typingState;
  linesRef.current = lines;
  ttsSettingsRef.current = ttsSettings;
  isEditModeRef.current = isEditMode;
  loopInactivityEnabledRef.current = loopInactivityEnabled;

  // Parse text into lines
  useEffect(() => {
    const parsedLines = sourceText.split('\n').map((text, index) => ({ text: text || '', index }));
    setLines(parsedLines);
    setEditText(sourceText);

    // Load saved progress
    const savedProgress = localStorage.getItem('typingProgress');
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        if (progress.sourceText === sourceText) {
          let lineIndex = progress.currentLineIndex || 0;
          // Skip lines with empty rendered text on load so typing isn't blocked
          for (let i = lineIndex; i < parsedLines.length; i++) {
            if (getRenderedText(parsedLines[i].text).length > 0) {
              lineIndex = i;
              break;
            }
          }
          setTypingState({
            currentLineIndex: lineIndex,
            caretIndex: progress.caretIndex || 0,
            correctChars: new Set(progress.correctChars || []),
            errorChars: new Set(progress.errorChars || []),
            lastSpokenWord: progress.lastSpokenWord || '',
            wordsTyped: progress.wordsTyped || 0,
            errors: progress.errors || 0,
            totalCharsTyped: progress.totalCharsTyped || 0,
          });
        }
      } catch {
        // ignore
      }
    }
  }, [sourceText]);

  // Persist loop toggle
  useEffect(() => {
    localStorage.setItem('loopInactivityEnabled', String(loopInactivityEnabled));
  }, [loopInactivityEnabled]);

  // Auto-focus and scroll
  useEffect(() => {
    if (!isEditMode) {
      focusRef.current?.focus();
      activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [typingState.currentLineIndex, isEditMode]);

  // Save progress
  useEffect(() => {
    localStorage.setItem(
      'typingProgress',
      JSON.stringify({
        sourceText,
        currentLineIndex: typingState.currentLineIndex,
        caretIndex: typingState.caretIndex,
        correctChars: Array.from(typingState.correctChars),
        errorChars: Array.from(typingState.errorChars),
        lastSpokenWord: typingState.lastSpokenWord,
        wordsTyped: typingState.wordsTyped,
        errors: typingState.errors,
        totalCharsTyped: typingState.totalCharsTyped,
      })
    );
  }, [typingState, sourceText]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditModeRef.current) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) return;

      const state = typingStateRef.current;
      const currentLine = linesRef.current[state.currentLineIndex];
      if (!currentLine) return;
      const text = currentLine.text;
      const renderedText = getRenderedText(text);

      // Stop inactivity loop on any typing activity
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        stopInactivityLoop();
      }

      // Auto-skip empty rendered lines
      if (renderedText.length === 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          let prevIndex = state.currentLineIndex - 1;
          for (; prevIndex >= 0; prevIndex--) {
            if (getRenderedText(linesRef.current[prevIndex].text).length > 0) break;
          }
          if (prevIndex >= 0) {
            setTypingState((prev) => ({
              ...prev,
              currentLineIndex: prevIndex,
              caretIndex: 0,
              correctChars: new Set(),
              errorChars: new Set(),
              lastSpokenWord: '',
            }));
          }
          return;
        }
        if (e.key === 'ArrowDown' || e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          let nextIndex = state.currentLineIndex + 1;
          for (; nextIndex < linesRef.current.length; nextIndex++) {
            if (getRenderedText(linesRef.current[nextIndex].text).length > 0) break;
          }
          if (nextIndex < linesRef.current.length) {
            setTypingState((prev) => ({
              ...prev,
              currentLineIndex: nextIndex,
              caretIndex: 0,
              correctChars: new Set(),
              errorChars: new Set(),
              lastSpokenWord: '',
            }));
          }
          return;
        }
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setTypingState((prev) => ({ ...prev, caretIndex: Math.max(0, prev.caretIndex - 1) }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setTypingState((prev) => ({ ...prev, caretIndex: Math.min(renderedText.length, prev.caretIndex + 1) }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (state.currentLineIndex > 0) {
            let target = state.currentLineIndex - 1;
            for (; target >= 0; target--) {
              if (getRenderedText(linesRef.current[target].text).length > 0) break;
            }
            if (target >= 0) {
              const newCaret = Math.min(state.caretIndex, getRenderedText(linesRef.current[target].text).length);
              setTypingState((prev) => ({
                ...prev,
                currentLineIndex: target,
                caretIndex: newCaret,
                lastSpokenWord: '',
              }));
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (state.currentLineIndex < linesRef.current.length - 1) {
            let target = state.currentLineIndex + 1;
            for (; target < linesRef.current.length; target++) {
              if (getRenderedText(linesRef.current[target].text).length > 0) break;
            }
            if (target < linesRef.current.length) {
              const newCaret = Math.min(state.caretIndex, getRenderedText(linesRef.current[target].text).length);
              setTypingState((prev) => ({
                ...prev,
                currentLineIndex: target,
                caretIndex: newCaret,
                lastSpokenWord: '',
              }));
            }
          }
          break;
        case 'Backspace':
          e.preventDefault();
          setTypingState((prev) => {
            if (prev.caretIndex <= 0) return prev;
            const newCorrect = new Set(prev.correctChars);
            const newErrors = new Set(prev.errorChars);
            newCorrect.delete(prev.caretIndex - 1);
            newErrors.delete(prev.caretIndex - 1);
            return { ...prev, caretIndex: prev.caretIndex - 1, correctChars: newCorrect, errorChars: newErrors };
          });
          break;
        case 'Delete':
          e.preventDefault();
          setTypingState((prev) => {
            if (prev.caretIndex >= renderedText.length) return prev;
            const newCorrect = new Set(prev.correctChars);
            const newErrors = new Set(prev.errorChars);
            newCorrect.delete(prev.caretIndex);
            newErrors.delete(prev.caretIndex);
            return { ...prev, correctChars: newCorrect, errorChars: newErrors };
          });
          break;
        default: {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const expectedChar = renderedText[state.caretIndex];
            if (expectedChar === undefined) return;

            if (e.key === expectedChar) {
              playSound('key');
              setTypingState((prev) => {
                const newCorrect = new Set(prev.correctChars);
                newCorrect.add(prev.caretIndex);
                const newCaret = Math.min(renderedText.length, prev.caretIndex + 1);

                const completedWord = checkWordCompletion(renderedText, newCaret);
                const isLineComplete = newCorrect.size === renderedText.length && renderedText.length > 0;

                if (isLineComplete) {
                  playSound('lineComplete');
                  setTimeout(() => {
                    const settings = ttsSettingsRef.current;
                    // Find next line with non-empty rendered text
                    let nextLineIndex = prev.currentLineIndex + 1;
                    for (let i = nextLineIndex; i < linesRef.current.length; i++) {
                      if (getRenderedText(linesRef.current[i].text).length > 0) {
                        nextLineIndex = i;
                        break;
                      }
                    }
                    if (settings.autoplayNextLine && nextLineIndex < linesRef.current.length) {
                      const nextLine = linesRef.current[nextLineIndex];
                      if (nextLine) speak(getRenderedText(nextLine.text));
                    }
                    setTypingState((p) => ({
                      ...p,
                      currentLineIndex: Math.min(nextLineIndex, linesRef.current.length - 1),
                      caretIndex: 0,
                      correctChars: new Set(),
                      errorChars: new Set(),
                      lastSpokenWord: '',
                      wordsTyped: p.wordsTyped,
                    }));
                  }, 300);
                } else if (completedWord && completedWord !== prev.lastSpokenWord) {
                  playSound('wordComplete');
                }

                if (completedWord && completedWord !== prev.lastSpokenWord && ttsSettingsRef.current.speakOnWordComplete) {
                  speak(completedWord, () => {
                    startInactivityLoop(renderedText, newCaret);
                  });
                }

                return {
                  ...prev,
                  caretIndex: newCaret,
                  correctChars: newCorrect,
                  wordsTyped: completedWord && completedWord !== prev.lastSpokenWord ? prev.wordsTyped + 1 : prev.wordsTyped,
                  totalCharsTyped: prev.totalCharsTyped + 1,
                  lastSpokenWord: completedWord || prev.lastSpokenWord,
                };
              });
            } else {
              playSound('error');
              setTypingState((prev) => {
                const newErrors = new Set(prev.errorChars);
                newErrors.add(prev.caretIndex);
                return {
                  ...prev,
                  errorChars: newErrors,
                  errors: prev.errors + 1,
                  totalCharsTyped: prev.totalCharsTyped + 1,
                };
              });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback(
    (type: SoundType) => {
      const settings = ttsSettingsRef.current;
      if (!settings.soundEnabled) return;
      const volume = settings.soundVolume ?? 0.5;
      if (volume <= 0) return;

      try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        switch (type) {
          case 'key': {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(820, t);
            osc.frequency.exponentialRampToValueAtTime(520, t + 0.04);
            gain.gain.setValueAtTime(0.04 * volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            osc.start(t);
            osc.stop(t + 0.05);
            break;
          }
          case 'error': {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, t);
            gain.gain.setValueAtTime(0.08 * volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.start(t);
            osc.stop(t + 0.13);
            break;
          }
          case 'wordComplete': {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, t);
            osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
            gain.gain.setValueAtTime(0.06 * volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.start(t);
            osc.stop(t + 0.13);
            break;
          }
          case 'lineComplete': {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.exponentialRampToValueAtTime(1320, t + 0.25);
            gain.gain.setValueAtTime(0.08 * volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.start(t);
            osc.stop(t + 0.32);
            break;
          }
          case 'click': {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(260, t);
            gain.gain.setValueAtTime(0.02 * volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
            osc.start(t);
            osc.stop(t + 0.04);
            break;
          }
        }
      } catch {
        // ignore audio errors
      }
    },
    [getAudioContext]
  );

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!text) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = window.speechSynthesis.getVoices().find((v) => v.name === ttsSettingsRef.current.voice);
      if (voice) utterance.voice = voice;
      utterance.rate = ttsSettingsRef.current.rate;
      utterance.pitch = ttsSettingsRef.current.pitch;
      utterance.volume = ttsSettingsRef.current.volume;

      if (onEnd) {
        utterance.onend = onEnd;
      }

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    },
    []
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    loopAbortRef.current = true;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const checkWordCompletion = useCallback((line: string, caretIndex: number) => {
    if (caretIndex === 0) return null;
    const nextChar = line[caretIndex];
    const isWordBoundary = !nextChar || /[\s,.!?;:\-—]/.test(nextChar);

    if (isWordBoundary) {
      let wordStart = caretIndex - 1;
      while (wordStart >= 0 && !/[\s,.!?;:\-—]/.test(line[wordStart])) {
        wordStart--;
      }
      wordStart++;
      const word = line.substring(wordStart, caretIndex).trim();
      return word || null;
    }
    return null;
  }, []);

  const startInactivityLoop = useCallback(
    (lineText: string, caretIndex: number) => {
      if (!loopInactivityEnabledRef.current) return;
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      loopAbortRef.current = false;

      // Build text from start of line up to and including the current word
      let end = caretIndex;
      const nextChar = lineText[end];
      if (nextChar && /[\s,.!?;:\-—]/.test(nextChar)) {
        end++;
      }
      loopTextRef.current = lineText.substring(0, end).trim();
      if (!loopTextRef.current) return;

      inactivityTimerRef.current = setTimeout(() => {
        if (loopAbortRef.current || !loopTextRef.current) return;
        const doLoop = () => {
          if (loopAbortRef.current || !loopTextRef.current) return;
          speak(loopTextRef.current, () => {
            if (loopAbortRef.current) return;
            inactivityTimerRef.current = setTimeout(() => {
              if (loopAbortRef.current) return;
              doLoop();
            }, 2000);
          });
        };
        doLoop();
      }, 2000);
    },
    [speak]
  );

  const stopInactivityLoop = useCallback(() => {
    loopAbortRef.current = true;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  const handleLineClick = useCallback(
    (lineIndex: number) => {
      playSound('click');
      if (ttsSettingsRef.current.clickLineToPlay) {
        const line = linesRef.current[lineIndex];
        if (line) {
          const rendered = getRenderedText(line.text);
          if (rendered) speak(rendered);
        }
      }
    },
    [speak, playSound]
  );

  const playAll = useCallback(() => {
    playSound('click');
    stopSpeaking();
    const remainingText = linesRef.current
      .slice(typingStateRef.current.currentLineIndex)
      .map((l) => getRenderedText(l.text))
      .filter((t) => t.length > 0)
      .join(' ');
    speak(remainingText);
  }, [speak, stopSpeaking, playSound]);

  const playLine = useCallback(() => {
    playSound('click');
    stopSpeaking();
    const currentLine = linesRef.current[typingStateRef.current.currentLineIndex];
    if (currentLine) {
      const rendered = getRenderedText(currentLine.text);
      if (!rendered) return;
      if (ttsSettingsRef.current.loopCurrentLine && ttsSettingsRef.current.loopCount > 1) {
        loopCountRef.current = 0;
        const playLoop = () => {
          loopCountRef.current++;
          if (loopCountRef.current < ttsSettingsRef.current.loopCount) {
            speak(rendered, playLoop);
          } else {
            speak(rendered);
          }
        };
        playLoop();
      } else {
        speak(rendered);
      }
    }
  }, [speak, stopSpeaking, playSound]);

  const replayWord = useCallback(() => {
    playSound('click');
    if (typingStateRef.current.lastSpokenWord) {
      speak(typingStateRef.current.lastSpokenWord);
    }
  }, [speak, playSound]);

  const prevLine = useCallback(() => {
    playSound('click');
    stopInactivityLoop();
    if (typingStateRef.current.currentLineIndex > 0) {
      setTypingState((prev) => {
        let target = prev.currentLineIndex - 1;
        for (let i = target; i >= 0; i--) {
          if (getRenderedText(linesRef.current[i].text).length > 0) {
            target = i;
            break;
          }
        }
        if (target === prev.currentLineIndex) return prev;
        return {
          ...prev,
          currentLineIndex: target,
          caretIndex: 0,
          correctChars: new Set(),
          errorChars: new Set(),
          lastSpokenWord: '',
          wordsTyped: prev.wordsTyped,
        };
      });
    }
  }, [playSound, stopInactivityLoop]);

  const nextLine = useCallback(() => {
    playSound('click');
    stopInactivityLoop();
    if (typingStateRef.current.currentLineIndex < linesRef.current.length - 1) {
      setTypingState((prev) => {
        let target = prev.currentLineIndex + 1;
        for (let i = target; i < linesRef.current.length; i++) {
          if (getRenderedText(linesRef.current[i].text).length > 0) {
            target = i;
            break;
          }
        }
        if (target >= linesRef.current.length) return prev;
        return {
          ...prev,
          currentLineIndex: target,
          caretIndex: 0,
          correctChars: new Set(),
          errorChars: new Set(),
          lastSpokenWord: '',
          wordsTyped: prev.wordsTyped,
        };
      });
    }
  }, [playSound, stopInactivityLoop]);

  const handleRestart = useCallback(() => {
    playSound('click');
    localStorage.removeItem('typingProgress');
    onRestart();
  }, [onRestart, playSound]);

  const handleToggleEdit = useCallback(() => {
    playSound('click');
    if (isEditMode) {
      // Exiting edit mode: update source text
      const trimmed = editText.trimEnd();
      if (onSourceTextChange) onSourceTextChange(trimmed);
      setIsEditMode(false);
      // Reset typing progress when source changes
      setTypingState({
        currentLineIndex: 0,
        caretIndex: 0,
        correctChars: new Set(),
        errorChars: new Set(),
        lastSpokenWord: '',
        errors: 0,
        totalCharsTyped: 0,
      });
    } else {
      setIsEditMode(true);
      setEditText(sourceText);
    }
  }, [isEditMode, editText, onSourceTextChange, sourceText, playSound]);

  const setCaret = useCallback((index: number) => {
    if (isEditModeRef.current) return;
    setTypingState((prev) => ({ ...prev, caretIndex: index }));
    focusRef.current?.focus();
  }, []);

  const currentLine = lines[typingState.currentLineIndex];
  const totalWords = typingState.wordsTyped;
  const accuracy =
    typingState.totalCharsTyped > 0
      ? Math.round(((typingState.totalCharsTyped - typingState.errors) / typingState.totalCharsTyped) * 100)
      : 100;

  return (
    <div className="size-full flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/50 backdrop-blur-xl bg-[var(--glass-bg)]">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleRestart();
          }}
          className="cursor-pointer"
        >
          <h1 className="text-xl sm:text-2xl md:text-3xl font-light tracking-tight" style={{ fontFamily: 'var(--font-content)' }}>
            Typing Session
          </h1>
        </a>
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={handleToggleEdit}
            className="p-2 hover:bg-accent/50 rounded-lg transition-all active:scale-95 flex items-center gap-2"
            title={isEditMode ? 'Done Editing' : 'Edit Source'}
          >
            {isEditMode ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />}
            <span className="hidden sm:inline text-sm">{isEditMode ? 'Done' : 'Edit'}</span>
          </button>
          <button
            onClick={handleRestart}
            className="p-2 hover:bg-accent/50 rounded-lg transition-all active:scale-95"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={onSettingsOpen}
            className="p-2 hover:bg-accent/50 rounded-lg transition-all active:scale-95"
            title="Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-3 sm:p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          {isEditMode ? (
            <div className="backdrop-blur-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl p-4 sm:p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Type className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-medium">Edit Markdown Source</h2>
              </div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full h-[50vh] p-4 backdrop-blur-md bg-input border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm sm:text-base font-mono"
                style={{ lineHeight: '1.8' }}
                autoFocus
              />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleToggleEdit}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md text-sm font-medium"
                >
                  Done Editing
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Focus capture div */}
              <div
                ref={focusRef}
                tabIndex={0}
                className="outline-none"
                onClick={() => focusRef.current?.focus()}
              />
              <div className="space-y-1.5 sm:space-y-2">
                {lines.map((line, lineIndex) => {
                  const isActive = lineIndex === typingState.currentLineIndex;
                  const isPast = lineIndex < typingState.currentLineIndex;
                  const isFuture = lineIndex > typingState.currentLineIndex;
                  const renderedChars = parseRenderedChars(line.text);
                  const lineStyle = getLineStyleClass(line.text);

                  return (
                    <div
                      key={line.index}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => handleLineClick(lineIndex)}
                      className={`
                        p-3 sm:p-4 rounded-xl transition-all cursor-pointer
                        ${isActive ? 'backdrop-blur-xl bg-accent/40 border-2 border-primary/50 shadow-xl scale-[1.01]' : ''}
                        ${isPast ? 'opacity-50 backdrop-blur-sm bg-white/20' : ''}
                        ${isFuture ? 'opacity-30' : ''}
                        ${ttsSettings.clickLineToPlay ? 'hover:backdrop-blur-lg hover:bg-accent/20' : ''}
                      `}
                      style={{ fontFamily: 'var(--font-content)', fontSize: 'clamp(1.125rem, 4vw, 1.5rem)', lineHeight: '1.8' }}
                    >
                      {isActive ? (
                        <div className={`flex flex-wrap ${lineStyle}`}>
                          {renderedChars.map((rc, charIndex) => {
                            const isCorrect = typingState.correctChars.has(charIndex);
                            const isError = typingState.errorChars.has(charIndex);
                            const isCaret = charIndex === typingState.caretIndex;

                            return (
                              <span
                                key={charIndex}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCaret(charIndex);
                                }}
                                className={`
                                  transition-all duration-150 select-none
                                  ${rc.bold ? 'font-semibold' : ''}
                                  ${rc.italic ? 'italic' : ''}
                                  ${rc.code ? 'bg-muted px-1.5 py-0.5 rounded text-sm font-mono' : ''}
                                  ${rc.strike ? 'line-through' : ''}
                                  ${rc.link ? 'text-primary underline' : ''}
                                  ${isCorrect ? 'text-primary/90 font-medium' : ''}
                                  ${isError ? 'text-destructive bg-destructive/20 px-0.5 rounded' : ''}
                                  ${isCaret ? 'bg-primary text-primary-foreground px-1 rounded-md shadow-lg' : ''}
                                  ${!isCorrect && !isError && !isCaret ? 'text-foreground/40' : ''}
                                `}
                              >
                                {rc.char === ' ' ? '\u00A0' : rc.char}
                              </span>
                            );
                          })}
                          {typingState.caretIndex === renderedChars.length && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setCaret(renderedChars.length);
                              }}
                              className="bg-primary text-primary-foreground px-1 rounded-md shadow-lg select-none"
                            >
                              {'\u00A0'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className={isPast ? 'line-through opacity-70' : ''}>
                          <MarkdownLine content={line.text || '\u00A0'} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      {!isEditMode && (
        <div className="border-t border-border/50 backdrop-blur-xl bg-[var(--glass-bg)]">
          <div className="px-3 sm:px-6 py-2 sm:py-3 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2 sm:gap-6 text-xs sm:text-sm min-w-max">
              <div className="flex gap-3 sm:gap-6 text-muted-foreground">
                <span>
                  Line: <strong className="text-foreground font-semibold">{typingState.currentLineIndex + 1}</strong>/{lines.length}
                </span>
                <span className="hidden sm:inline">
                  Words: <strong className="text-foreground font-semibold">{totalWords}</strong>
                </span>
                <span>
                  Chars: <strong className="text-foreground font-semibold">{typingState.totalCharsTyped}</strong>
                </span>
                <span>
                  Accuracy: <strong className="text-foreground font-semibold">{accuracy}%</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto">
            <div className="flex gap-1.5 sm:gap-2">
              <button
                onClick={playAll}
                className="p-2 sm:p-3 bg-primary text-primary-foreground rounded-xl hover:shadow-lg hover:scale-105 active:scale-95 transition-all shadow-md"
                title="Play All"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={playLine}
                className="p-2 sm:p-3 backdrop-blur-md bg-secondary text-secondary-foreground rounded-xl hover:scale-105 active:scale-95 transition-all"
                title="Play Line"
              >
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={replayWord}
                className="p-2 sm:p-3 backdrop-blur-md bg-secondary text-secondary-foreground rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Replay Word"
                disabled={!typingState.lastSpokenWord}
              >
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
                onClick={stopSpeaking}
                className="p-2 sm:p-3 backdrop-blur-md bg-secondary text-secondary-foreground rounded-xl hover:scale-105 active:scale-95 transition-all"
                title="Pause"
              >
                <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={stopSpeaking}
                className="p-2 sm:p-3 backdrop-blur-md bg-secondary text-secondary-foreground rounded-xl hover:scale-105 active:scale-95 transition-all"
                title="Stop"
              >
                <Square className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => {
                  playSound('click');
                  setLoopInactivityEnabled((v) => {
                    const next = !v;
                    if (!next) stopInactivityLoop();
                    return next;
                  });
                }}
                className={`p-2 sm:p-3 rounded-xl hover:scale-105 active:scale-95 transition-all ${
                  loopInactivityEnabled
                    ? 'bg-primary/20 text-primary'
                    : 'backdrop-blur-md bg-secondary text-secondary-foreground'
                }`}
                title={loopInactivityEnabled ? 'Inactivity loop on' : 'Inactivity loop off'}
              >
                <Repeat className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="w-px h-6 sm:h-8 bg-border/50 mx-1 sm:mx-2" />
            <div className="flex gap-1.5 sm:gap-2">
              <button
                onClick={prevLine}
                className="p-2 sm:p-3 backdrop-blur-md bg-secondary text-secondary-foreground rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous Line"
                disabled={typingState.currentLineIndex === 0}
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={nextLine}
                className="p-2 sm:p-3 backdrop-blur-md bg-secondary text-secondary-foreground rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Line"
                disabled={typingState.currentLineIndex === lines.length - 1}
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Markdown rendering helpers for typing target

interface RenderedChar {
  char: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  link?: boolean;
}

function parseRenderedChars(raw: string): RenderedChar[] {
  let text = raw;

  const headingMatch = text.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) text = headingMatch[2];

  const listMatch = text.match(/^([-*]|\d+\.)\s+(.*)$/);
  if (listMatch) text = listMatch[2];

  const quoteMatch = text.match(/^>\s?(.*)$/);
  if (quoteMatch) text = quoteMatch[1];

  if (/^(---|___|\*\*\*)\s*$/.test(text.trim())) return [];
  if (text.startsWith('```')) return [];

  return parseInlineChars(text);
}

function getRenderedText(raw: string): string {
  return parseRenderedChars(raw).map((c) => c.char).join('');
}

function getLineStyleClass(raw: string): string {
  if (/^(#{1,6})\s+/.test(raw)) {
    const level = raw.match(/^(#{1,6})/)![0].length;
    return [
      'text-2xl font-bold mt-3 mb-2',
      'text-xl font-bold mt-3 mb-1',
      'text-lg font-semibold mt-2 mb-1',
      'text-base font-semibold mt-2 mb-1',
      'text-sm font-semibold mt-2 mb-0.5',
      'text-xs font-semibold mt-2 mb-0.5',
    ][level - 1];
  }
  return '';
}

function parseInlineChars(text: string): RenderedChar[] {
  const chars: RenderedChar[] = [];
  const addChars = (str: string, attrs: Partial<RenderedChar> = {}) => {
    for (const c of str) chars.push({ char: c, ...attrs });
  };

  let remaining = text;
  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^(``)([^`]|`[^`])*``/);
    if (codeMatch) {
      const inner = codeMatch[0].slice(2, -2);
      addChars(inner, { code: true });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    const singleCodeMatch = remaining.match(/^(`+)([\s\S]*?)\1/);
    if (singleCodeMatch) {
      addChars(singleCodeMatch[2], { code: true });
      remaining = remaining.slice(singleCodeMatch[0].length);
      continue;
    }

    const boldMatch = remaining.match(/^\*\*([\s\S]*?)\*\*/);
    if (boldMatch) {
      addChars(boldMatch[1], { bold: true });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const italicMatch = remaining.match(/^\*([\s\S]*?)\*/);
    if (italicMatch) {
      addChars(italicMatch[1], { italic: true });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    const strikeMatch = remaining.match(/^~~([\s\S]*?)~~/);
    if (strikeMatch) {
      addChars(strikeMatch[1], { strike: true });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      addChars(linkMatch[1], { link: true });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    addChars(remaining[0]);
    remaining = remaining.slice(1);
  }
  return chars;
}
