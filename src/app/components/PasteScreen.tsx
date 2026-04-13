import { useState, useEffect } from 'react';
import { FileText, Type, Hash } from 'lucide-react';

interface PasteScreenProps {
  onSubmit: (text: string) => void;
  initialText: string;
}

const SAMPLE_FRENCH_TEXT = `Bonjour! Bienvenue à cette expérience d'apprentissage.
Aujourd'hui nous allons pratiquer la frappe en français.
C'est une excellente façon d'améliorer votre vitesse et votre précision.
N'oubliez pas de faire attention aux accents et à la ponctuation.
Bonne chance et amusez-vous bien!`;

export default function PasteScreen({ onSubmit, initialText }: PasteScreenProps) {
  const [text, setText] = useState(initialText || SAMPLE_FRENCH_TEXT);
  const [stats, setStats] = useState({ lines: 0, words: 0, chars: 0 });

  useEffect(() => {
    const lines = text.trim().split('\n').filter(line => line.trim()).length;
    const words = text.trim().split(/\s+/).filter(word => word).length;
    const chars = text.length;
    setStats({ lines, words, chars });
  }, [text]);

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(text);
    }
  };

  return (
    <div className="size-full flex items-center justify-center p-4 sm:p-6 overflow-auto">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4 font-light tracking-tight" style={{ fontFamily: 'var(--font-content)' }}>
            Typing Trainer
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Paste your text, configure speech, and start typing
          </p>
        </div>

        <div className="backdrop-blur-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl p-5 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <label className="block mb-3 text-sm sm:text-base text-foreground/90 font-medium">
              Source Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your text here..."
              className="w-full h-64 sm:h-80 p-3 sm:p-4 backdrop-blur-md bg-input border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm sm:text-base"
              style={{ fontFamily: 'var(--font-content)', lineHeight: '1.8' }}
            />
          </div>

          <div className="flex flex-wrap gap-4 sm:gap-8 mb-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Lines:</span>
              <span className="font-semibold text-foreground">{stats.lines}</span>
            </div>
            <div className="flex items-center gap-2">
              <Type className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Words:</span>
              <span className="font-semibold text-foreground">{stats.words}</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Characters:</span>
              <span className="font-semibold text-foreground">{stats.chars}</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-full py-3 sm:py-4 bg-primary text-primary-foreground rounded-xl transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm sm:text-base font-medium"
          >
            Submit & Configure Speech
          </button>
        </div>
      </div>
    </div>
  );
}
