import { useState, useEffect } from 'react';
import PasteScreen from './components/PasteScreen';
import TTSModal from './components/TTSModal';
import TypingTrainer from './components/TypingTrainer';

export interface TTSSettings {
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  speakOnWordComplete: boolean;
  clickLineToPlay: boolean;
  autoplayNextLine: boolean;
  loopCurrentLine: boolean;
  loopCount: number;
}

export default function App() {
  const [screen, setScreen] = useState<'paste' | 'typing'>('paste');
  const [showTTSModal, setShowTTSModal] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [ttsSettings, setTTSSettings] = useState<TTSSettings>({
    voice: '',
    rate: 1,
    pitch: 1,
    volume: 1,
    speakOnWordComplete: true,
    clickLineToPlay: true,
    autoplayNextLine: false,
    loopCurrentLine: false,
    loopCount: 1,
  });

  // Load persisted data on mount
  useEffect(() => {
    const savedText = localStorage.getItem('sourceText');
    const savedSettings = localStorage.getItem('ttsSettings');

    if (savedText) {
      setSourceText(savedText);
    }
    if (savedSettings) {
      setTTSSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleTextSubmit = (text: string) => {
    setSourceText(text);
    localStorage.setItem('sourceText', text);
    setShowTTSModal(true);
  };

  const handleTTSConfigured = (settings: TTSSettings) => {
    setTTSSettings(settings);
    localStorage.setItem('ttsSettings', JSON.stringify(settings));
    setShowTTSModal(false);
    setScreen('typing');
  };

  const handleRestart = () => {
    setScreen('paste');
  };

  const handleSettingsOpen = () => {
    setShowTTSModal(true);
  };

  return (
    <div className="size-full">
      {screen === 'paste' && (
        <PasteScreen onSubmit={handleTextSubmit} initialText={sourceText} />
      )}

      {screen === 'typing' && (
        <TypingTrainer
          sourceText={sourceText}
          ttsSettings={ttsSettings}
          onRestart={handleRestart}
          onSettingsOpen={handleSettingsOpen}
        />
      )}

      <TTSModal
        open={showTTSModal}
        onClose={() => setShowTTSModal(false)}
        onConfirm={handleTTSConfigured}
        initialSettings={ttsSettings}
      />
    </div>
  );
}
