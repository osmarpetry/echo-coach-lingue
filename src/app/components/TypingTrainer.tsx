import { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Settings, Play, Pause, Square, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { TTSSettings } from '../App';

interface TypingTrainerProps {
  sourceText: string;
  ttsSettings: TTSSettings;
  onRestart: () => void;
  onSettingsOpen: () => void;
}

interface Line {
  text: string;
  index: number;
}

interface TypingState {
  currentLineIndex: number;
  currentCharIndex: number;
  completedWords: Set<string>;
  lastSpokenWord: string;
  errors: number;
  totalCharsTyped: number;
}

export default function TypingTrainer({ sourceText, ttsSettings, onRestart, onSettingsOpen }: TypingTrainerProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [typingState, setTypingState] = useState<TypingState>({
    currentLineIndex: 0,
    currentCharIndex: 0,
    completedWords: new Set(),
    lastSpokenWord: '',
    errors: 0,
    totalCharsTyped: 0,
  });
  const [inputValue, setInputValue] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const loopCountRef = useRef(0);

  // Parse text into lines
  useEffect(() => {
    const parsedLines = sourceText
      .split('\n')
      .map((text, index) => ({ text: text || '', index }));
    setLines(parsedLines);

    // Load saved progress
    const savedProgress = localStorage.getItem('typingProgress');
    if (savedProgress) {
      const progress = JSON.parse(savedProgress);
      if (progress.sourceText === sourceText) {
        setTypingState(prev => ({
          ...prev,
          currentLineIndex: progress.currentLineIndex || 0,
          currentCharIndex: progress.currentCharIndex || 0,
          errors: progress.errors || 0,
          totalCharsTyped: progress.totalCharsTyped || 0,
        }));

        const line = parsedLines[progress.currentLineIndex || 0];
        if (line) {
          setInputValue(line.text.substring(0, progress.currentCharIndex || 0));
        }
      }
    }
  }, [sourceText]);

  // Auto-focus and scroll
  useEffect(() => {
    inputRef.current?.focus();
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [typingState.currentLineIndex]);

  // Save progress
  useEffect(() => {
    localStorage.setItem('typingProgress', JSON.stringify({
      sourceText,
      currentLineIndex: typingState.currentLineIndex,
      currentCharIndex: typingState.currentCharIndex,
      errors: typingState.errors,
      totalCharsTyped: typingState.totalCharsTyped,
    }));
  }, [typingState, sourceText]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = window.speechSynthesis.getVoices().find(v => v.name === ttsSettings.voice);
    if (voice) utterance.voice = voice;
    utterance.rate = ttsSettings.rate;
    utterance.pitch = ttsSettings.pitch;
    utterance.volume = ttsSettings.volume;

    if (onEnd) {
      utterance.onend = onEnd;
    }

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [ttsSettings]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  const checkWordCompletion = useCallback((line: string, charIndex: number) => {
    if (charIndex === 0) return null;

    const nextChar = line[charIndex];
    const isWordBoundary = !nextChar || /[\s,.!?;:\-—]/.test(nextChar);

    if (isWordBoundary) {
      let wordStart = charIndex - 1;
      while (wordStart >= 0 && !/[\s,.!?;:\-—]/.test(line[wordStart])) {
        wordStart--;
      }
      wordStart++;

      const word = line.substring(wordStart, charIndex).trim();
      return word;
    }

    return null;
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const currentLine = lines[typingState.currentLineIndex];
    if (!currentLine) return;

    const currentLineText = currentLine.text;
    const expectedChar = currentLineText[typingState.currentCharIndex];

    // Handle backspace
    if (newValue.length < inputValue.length) {
      setInputValue(newValue);
      setTypingState(prev => ({
        ...prev,
        currentCharIndex: Math.max(0, newValue.length),
      }));
      return;
    }

    const typedChar = newValue[newValue.length - 1];

    // Check if character matches
    if (typedChar === expectedChar) {
      setInputValue(newValue);
      const newCharIndex = typingState.currentCharIndex + 1;

      setTypingState(prev => ({
        ...prev,
        currentCharIndex: newCharIndex,
        totalCharsTyped: prev.totalCharsTyped + 1,
      }));

      // Check for word completion
      if (ttsSettings.speakOnWordComplete) {
        const completedWord = checkWordCompletion(currentLineText, newCharIndex);
        if (completedWord && completedWord !== typingState.lastSpokenWord) {
          speak(completedWord);
          setTypingState(prev => ({
            ...prev,
            lastSpokenWord: completedWord,
            completedWords: new Set([...prev.completedWords, completedWord]),
          }));
        }
      }

      // Check if line is complete
      if (newCharIndex === currentLineText.length) {
        setTimeout(() => {
          if (ttsSettings.autoplayNextLine && typingState.currentLineIndex < lines.length - 1) {
            const nextLine = lines[typingState.currentLineIndex + 1];
            if (nextLine) {
              speak(nextLine.text);
            }
          }

          setTypingState(prev => ({
            ...prev,
            currentLineIndex: Math.min(prev.currentLineIndex + 1, lines.length - 1),
            currentCharIndex: 0,
            lastSpokenWord: '',
          }));
          setInputValue('');
        }, 300);
      }
    } else {
      // Wrong character - don't advance
      setTypingState(prev => ({
        ...prev,
        errors: prev.errors + 1,
      }));
    }
  };

  const handleLineClick = (lineIndex: number) => {
    if (ttsSettings.clickLineToPlay) {
      const line = lines[lineIndex];
      if (line) {
        speak(line.text);
      }
    }
  };

  const playAll = () => {
    stopSpeaking();
    const remainingText = lines
      .slice(typingState.currentLineIndex)
      .map(l => l.text)
      .join(' ');
    speak(remainingText);
    setIsPlaying(true);
  };

  const playLine = () => {
    stopSpeaking();
    const currentLine = lines[typingState.currentLineIndex];
    if (currentLine) {
      if (ttsSettings.loopCurrentLine && ttsSettings.loopCount > 1) {
        loopCountRef.current = 0;
        const playLoop = () => {
          loopCountRef.current++;
          if (loopCountRef.current < ttsSettings.loopCount) {
            speak(currentLine.text, playLoop);
          } else {
            speak(currentLine.text);
          }
        };
        playLoop();
      } else {
        speak(currentLine.text);
      }
      setIsPlaying(true);
    }
  };

  const replayWord = () => {
    if (typingState.lastSpokenWord) {
      speak(typingState.lastSpokenWord);
    }
  };

  const prevLine = () => {
    if (typingState.currentLineIndex > 0) {
      setTypingState(prev => ({
        ...prev,
        currentLineIndex: prev.currentLineIndex - 1,
        currentCharIndex: 0,
        lastSpokenWord: '',
      }));
      setInputValue('');
    }
  };

  const nextLine = () => {
    if (typingState.currentLineIndex < lines.length - 1) {
      setTypingState(prev => ({
        ...prev,
        currentLineIndex: prev.currentLineIndex + 1,
        currentCharIndex: 0,
        lastSpokenWord: '',
      }));
      setInputValue('');
    }
  };

  const handleRestart = () => {
    localStorage.removeItem('typingProgress');
    onRestart();
  };

  const currentLine = lines[typingState.currentLineIndex];
  const totalWords = typingState.completedWords.size;
  const accuracy = typingState.totalCharsTyped > 0
    ? Math.round(((typingState.totalCharsTyped - typingState.errors) / typingState.totalCharsTyped) * 100)
    : 100;

  return (
    <div className="size-full flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/50 backdrop-blur-xl bg-[var(--glass-bg)]">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-light tracking-tight" style={{ fontFamily: 'var(--font-content)' }}>
          Typing Session
        </h1>
        <div className="flex gap-1.5 sm:gap-2">
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
          <div className="space-y-1.5 sm:space-y-2">
            {lines.map((line, lineIndex) => {
              const isActive = lineIndex === typingState.currentLineIndex;
              const isPast = lineIndex < typingState.currentLineIndex;
              const isFuture = lineIndex > typingState.currentLineIndex;

              return (
                <div
                  key={line.index}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => handleLineClick(lineIndex)}
                  className={`
                    p-3 sm:p-4 rounded-xl transition-all cursor-pointer
                    ${isActive ? 'backdrop-blur-xl bg-accent/40 border-2 border-primary/50 shadow-xl scale-[1.02]' : ''}
                    ${isPast ? 'opacity-50 backdrop-blur-sm bg-white/20' : ''}
                    ${isFuture ? 'opacity-30' : ''}
                    ${ttsSettings.clickLineToPlay ? 'hover:backdrop-blur-lg hover:bg-accent/20' : ''}
                  `}
                  style={{ fontFamily: 'var(--font-content)', fontSize: 'clamp(1.125rem, 4vw, 1.5rem)', lineHeight: '1.8' }}
                >
                  {isActive ? (
                    <div className="flex flex-wrap">
                      {line.text.split('').map((char, charIndex) => {
                        const isTyped = charIndex < typingState.currentCharIndex;
                        const isCurrent = charIndex === typingState.currentCharIndex;
                        const typedChar = inputValue[charIndex];
                        const isError = isTyped && typedChar !== char;

                        return (
                          <span
                            key={charIndex}
                            className={`
                              transition-all duration-150
                              ${isTyped && !isError ? 'text-primary/90 font-medium' : ''}
                              ${isError ? 'text-destructive bg-destructive/20 px-0.5 rounded' : ''}
                              ${isCurrent ? 'bg-primary text-primary-foreground px-1 rounded-md animate-pulse shadow-lg' : ''}
                              ${!isTyped && !isCurrent ? 'text-foreground/40' : ''}
                            `}
                          >
                            {char === ' ' ? '\u00A0' : char}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={isPast ? 'line-through opacity-70' : ''}>{line.text || '\u00A0'}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hidden input for typing */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInput}
        className="absolute opacity-0 pointer-events-none"
        autoFocus
      />

      {/* Bottom Controls */}
      <div className="border-t border-border/50 backdrop-blur-xl bg-[var(--glass-bg)]">
        <div className="px-3 sm:px-6 py-2 sm:py-3 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2 sm:gap-6 text-xs sm:text-sm min-w-max">
            <div className="flex gap-3 sm:gap-6 text-muted-foreground">
              <span>Line: <strong className="text-foreground font-semibold">{typingState.currentLineIndex + 1}</strong>/{lines.length}</span>
              <span className="hidden sm:inline">Words: <strong className="text-foreground font-semibold">{totalWords}</strong></span>
              <span>Chars: <strong className="text-foreground font-semibold">{typingState.totalCharsTyped}</strong></span>
              <span>Accuracy: <strong className="text-foreground font-semibold">{accuracy}%</strong></span>
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
    </div>
  );
}
