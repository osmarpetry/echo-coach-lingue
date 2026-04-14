import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Switch from '@radix-ui/react-switch';
import * as Slider from '@radix-ui/react-slider';
import { X, ChevronDown, ChevronUp, Volume2 } from 'lucide-react';
import { TTSSettings } from '../App';

interface TTSModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (settings: TTSSettings) => void;
  initialSettings: TTSSettings;
}

export default function TTSModal({ open, onClose, onConfirm, initialSettings }: TTSModalProps) {
  const [settings, setSettings] = useState<TTSSettings>(initialSettings);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      if (availableVoices.length > 0 && !settings.voice) {
        const frenchVoice = availableVoices.find(v => v.lang.startsWith('fr')) || availableVoices[0];
        setSettings(prev => ({ ...prev, voice: frenchVoice.name }));
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [settings.voice]);

  const handleConfirm = () => {
    onConfirm(settings);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 backdrop-blur-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl shadow-2xl p-5 sm:p-8 w-[calc(100%-2rem)] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <Dialog.Title className="text-2xl sm:text-3xl mb-2 font-light tracking-tight" style={{ fontFamily: 'var(--font-content)' }}>
                Text-to-Speech Settings
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm sm:text-base">
                Configure voice, playback, and sound options
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors ml-2 sm:ml-4">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-5 sm:space-y-6">
            {/* Voice Selection */}
            <div>
              <label className="block mb-2 text-sm sm:text-base text-foreground/90 font-medium">Voice</label>
              <select
                value={settings.voice}
                onChange={(e) => setSettings({ ...settings, voice: e.target.value })}
                className="w-full p-2.5 sm:p-3 backdrop-blur-md bg-input border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base transition-all"
              >
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Rate */}
            <div>
              <label className="block mb-2 text-sm sm:text-base text-foreground/90 font-medium">
                Rate: {settings.rate.toFixed(1)}x
              </label>
              <Slider.Root
                className="relative flex items-center w-full h-8 sm:h-10"
                value={[settings.rate]}
                onValueChange={([rate]) => setSettings({ ...settings, rate })}
                min={0.5}
                max={2}
                step={0.1}
              >
                <Slider.Track className="relative grow h-2 backdrop-blur-md bg-secondary rounded-full">
                  <Slider.Range className="absolute h-full bg-primary rounded-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-6 h-6 bg-white border-2 border-primary rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition-transform hover:scale-110" />
              </Slider.Root>
            </div>

            {/* Pitch */}
            <div>
              <label className="block mb-2 text-sm sm:text-base text-foreground/90 font-medium">
                Pitch: {settings.pitch.toFixed(1)}
              </label>
              <Slider.Root
                className="relative flex items-center w-full h-8 sm:h-10"
                value={[settings.pitch]}
                onValueChange={([pitch]) => setSettings({ ...settings, pitch })}
                min={0.5}
                max={2}
                step={0.1}
              >
                <Slider.Track className="relative grow h-2 backdrop-blur-md bg-secondary rounded-full">
                  <Slider.Range className="absolute h-full bg-primary rounded-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-6 h-6 bg-white border-2 border-primary rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition-transform hover:scale-110" />
              </Slider.Root>
            </div>

            {/* Volume */}
            <div>
              <label className="block mb-2 text-sm sm:text-base text-foreground/90 font-medium">
                TTS Volume: {Math.round(settings.volume * 100)}%
              </label>
              <Slider.Root
                className="relative flex items-center w-full h-8 sm:h-10"
                value={[settings.volume]}
                onValueChange={([volume]) => setSettings({ ...settings, volume })}
                min={0}
                max={1}
                step={0.1}
              >
                <Slider.Track className="relative grow h-2 backdrop-blur-md bg-secondary rounded-full">
                  <Slider.Range className="absolute h-full bg-primary rounded-full" />
                </Slider.Track>
                <Slider.Thumb className="block w-6 h-6 bg-white border-2 border-primary rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition-transform hover:scale-110" />
              </Slider.Root>
            </div>

            <div className="border-t border-border/50 pt-5 sm:pt-6 space-y-3 sm:space-y-4">
              {/* Toggles */}
              <SwitchField
                label="Speak completed word while typing"
                checked={settings.speakOnWordComplete}
                onCheckedChange={(checked) => setSettings({ ...settings, speakOnWordComplete: checked })}
              />

              <SwitchField
                label="Click a line to play that line"
                checked={settings.clickLineToPlay}
                onCheckedChange={(checked) => setSettings({ ...settings, clickLineToPlay: checked })}
              />

              <SwitchField
                label="Autoplay next line after completion"
                checked={settings.autoplayNextLine}
                onCheckedChange={(checked) => setSettings({ ...settings, autoplayNextLine: checked })}
              />

              <SwitchField
                label="Loop current line"
                checked={settings.loopCurrentLine}
                onCheckedChange={(checked) => setSettings({ ...settings, loopCurrentLine: checked })}
              />

              {settings.loopCurrentLine && (
                <div className="ml-4 sm:ml-6">
                  <label className="block mb-2 text-xs sm:text-sm text-foreground/90 font-medium">Loop count</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.loopCount}
                    onChange={(e) => setSettings({ ...settings, loopCount: parseInt(e.target.value) || 1 })}
                    className="w-20 sm:w-24 p-2 backdrop-blur-md bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              )}
            </div>

            {/* Sound Settings */}
            <div className="border-t border-border/50 pt-5 sm:pt-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-primary" />
                <span className="text-sm sm:text-base font-medium text-foreground/90">Typing Sound Feedback</span>
              </div>

              <SwitchField
                label="Enable typing sounds"
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, soundEnabled: checked })}
              />

              <div>
                <label className="block mb-2 text-xs sm:text-sm text-foreground/90 font-medium">
                  Sound Volume: {Math.round((settings.soundVolume ?? 0.5) * 100)}%
                </label>
                <Slider.Root
                  className="relative flex items-center w-full h-8 sm:h-10"
                  value={[settings.soundVolume ?? 0.5]}
                  onValueChange={([soundVolume]) => setSettings({ ...settings, soundVolume })}
                  min={0}
                  max={1}
                  step={0.05}
                >
                  <Slider.Track className="relative grow h-2 backdrop-blur-md bg-secondary rounded-full">
                    <Slider.Range className="absolute h-full bg-primary rounded-full" />
                  </Slider.Track>
                  <Slider.Thumb className="block w-6 h-6 bg-white border-2 border-primary rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition-transform hover:scale-110" />
                </Slider.Root>
              </div>
            </div>

            {/* Advanced Section */}
            <div className="border-t border-border/50 pt-5 sm:pt-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Advanced (Premium TTS)
              </button>

              {showAdvanced && (
                <div className="mt-4 p-3 sm:p-4 backdrop-blur-lg bg-secondary/30 rounded-xl border border-border">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                    Premium TTS services require your own API key
                  </p>
                  <input
                    type="text"
                    placeholder="API Key (optional)"
                    className="w-full p-2.5 sm:p-3 backdrop-blur-md bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs sm:text-sm"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Feature available in future updates
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 sm:py-3 backdrop-blur-md bg-secondary text-secondary-foreground rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all text-sm sm:text-base font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2.5 sm:py-3 bg-primary text-primary-foreground rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md text-sm sm:text-base font-medium"
            >
              Start Typing
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SwitchField({ label, checked, onCheckedChange }: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs sm:text-sm text-foreground/90 flex-1">{label}</label>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="w-11 h-6 backdrop-blur-md bg-secondary rounded-full data-[state=checked]:bg-primary transition-all relative flex-shrink-0"
      >
        <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px] shadow-md" />
      </Switch.Root>
    </div>
  );
}
