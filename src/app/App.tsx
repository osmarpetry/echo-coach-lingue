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
  autoplayNextLine: boolean;
  loopCurrentLine: boolean;
  loopCount: number;
  soundEnabled: boolean;
  soundVolume: number;
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
    autoplayNextLine: false,
    loopCurrentLine: false,
    loopCount: 1,
    soundEnabled: true,
    soundVolume: 0.5,
  });

  // Load persisted data on mount
  useEffect(() => {
    const savedText = localStorage.getItem('sourceText');
    const savedSettings = localStorage.getItem('ttsSettings');

    if (savedText) {
      setSourceText(savedText);
    }
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        delete parsed.clickLineToPlay;
        setTTSSettings(prev => ({ ...prev, ...parsed }));
      } catch {
        // ignore parse errors
      }
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

  const handleSourceTextChange = (text: string) => {
    setSourceText(text);
    localStorage.setItem('sourceText', text);
  };

  const handleTTSSettingsChange = (settings: TTSSettings) => {
    setTTSSettings(settings);
    localStorage.setItem('ttsSettings', JSON.stringify(settings));
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
          onSourceTextChange={handleSourceTextChange}
          onTTSSettingsChange={handleTTSSettingsChange}
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
