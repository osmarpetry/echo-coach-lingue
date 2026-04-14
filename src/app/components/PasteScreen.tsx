import { useState, useEffect, useRef } from 'react';
import { FileText, Type, Hash, Eye, Code } from 'lucide-react';
import MarkdownLine from './MarkdownLine';

interface PasteScreenProps {
  onSubmit: (text: string) => void;
  initialText: string;
}

const SAMPLE_FRENCH_TEXT = `## Une Rencontre dans le Quartier

**Léo :** Salut Alice ! Tu **vas** bien ?

**Alice :** Oui, ça va très bien, merci ! Et toi ?

**Léo :** Ça va. Je **vais** à la boulangerie du quartier. Tu habites ici maintenant ?

**Alice :** Oui, j'habite ici. J'aime beaucoup ce quartier. Il y a un parc magnifique. Tu **vas** au parc **souvent** ?

**Léo :** Oui, j'y **vais** tous les matins avec mon chien. Mes amis, Marc et Julie, **vont** aussi au parc **de temps en temps** pour faire du sport.

**Alice :** C'est sympa ! Moi, je **vais** à la bibliothèque le samedi. Nous **allons** prendre un café ensemble ? Il y a un nouveau bistro juste là-bas.

**Léo :** Bonne idée ! Vous **allez** au bistro avec moi ? Ah, regarde ! Voilà Marc et Julie. Ils **vont** au cinéma, je pense.

**Alice :** Bonjour tout le monde ! On **va** prendre un café ?

**Marc :** Ah, désolé ! Nous **allons** à la gare maintenant. Mais nous **allons** au café avec vous la semaine prochaine, promis !

**Léo :** Pas de problème. À bientôt !

**Alice :** Alors, on y **va** ?

**Léo :** C'est parti !`;

export default function PasteScreen({ onSubmit, initialText }: PasteScreenProps) {
  const [text, setText] = useState(initialText || SAMPLE_FRENCH_TEXT);
  const [rawMode, setRawMode] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const lines = text.split('\n');

  const [stats, setStats] = useState({ lines: 0, words: 0, chars: 0 });

  useEffect(() => {
    const nonEmptyLines = text.trim().split('\n').filter((line) => line.trim()).length;
    const words = text.trim().split(/\s+/).filter((word) => word).length;
    const chars = text.length;
    setStats({ lines: nonEmptyLines, words, chars });
  }, [text]);

  useEffect(() => {
    if (editingIndex !== null) {
      const el = editRefs.current[editingIndex];
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [editingIndex]);

  const commitEdit = () => {
    if (editingIndex === null) return;
    const newLines = [...lines];
    newLines[editingIndex] = editingValue;
    const newText = newLines.join('\n');
    setText(newText);
    setEditingIndex(null);
    setEditingValue('');
  };

  const startEdit = (index: number) => {
    if (rawMode) return;
    setEditingIndex(index);
    setEditingValue(lines[index] ?? '');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      commitEdit();
    }
  };

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    if (rawMode) return;
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    if (pasted.includes('\n')) {
      e.preventDefault();
      setText(pasted);
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trimEnd();
    if (trimmed) {
      onSubmit(trimmed);
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
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm sm:text-base text-foreground/90 font-medium">Source Text</label>
              <button
                type="button"
                onClick={() => {
                  setRawMode((v) => !v);
                  setEditingIndex(null);
                }}
                className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent/40"
                title={rawMode ? 'Switch to visual preview' : 'Switch to raw markdown'}
              >
                {rawMode ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                {rawMode ? 'Visual' : 'Source'}
              </button>
            </div>

            {rawMode ? (
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here..."
                className="w-full h-64 sm:h-80 p-3 sm:p-4 backdrop-blur-md bg-input border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary transition-all text-sm sm:text-base"
                style={{ fontFamily: 'var(--font-content)', lineHeight: '1.8' }}
              />
            ) : (
              <div
                onPaste={handleContainerPaste}
                className="w-full h-64 sm:h-80 p-3 sm:p-4 backdrop-blur-md bg-input border border-border rounded-xl overflow-y-auto focus-within:ring-2 focus-within:ring-primary transition-all text-sm sm:text-base"
                style={{ fontFamily: 'var(--font-content)', lineHeight: '1.8' }}
              >
                <div className="space-y-0.5">
                  {lines.map((line, index) => {
                    const isEditing = editingIndex === index;
                    return (
                      <div
                        key={index}
                        onClick={() => startEdit(index)}
                        className={`rounded-lg px-2 py-1 -mx-2 transition-colors ${
                          isEditing
                            ? 'bg-transparent cursor-text'
                            : 'hover:bg-accent/30 cursor-pointer'
                        }`}
                      >
                        {isEditing ? (
                          <textarea
                            ref={(el) => (editRefs.current[index] = el)}
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-background/80 border border-primary/40 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary resize-none overflow-hidden"
                            style={{ fontFamily: 'var(--font-content)', lineHeight: '1.8', minHeight: '2rem' }}
                            rows={1}
                            autoFocus
                          />
                        ) : (
                          <MarkdownLine content={line} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
