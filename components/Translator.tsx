import React, { useState, useEffect, useRef } from 'react';
import { ALL_LANGUAGES, TTS_PROVIDERS } from '../constants';
import { pollTranscript } from '../services/supabase';
import { translateText, generateSpeech } from '../services/gemini';

const Translator: React.FC = () => {
  const [meetingId, setMeetingId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [targetLang, setTargetLang] = useState('es-ES');
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  // Set default to Cartesia value
  const [ttsProviderValue, setTtsProviderValue] = useState('cartesia'); 
  const [ttsEnabled, setTtsEnabled] = useState(true);
  
  // To track polling changes
  const lastProcessedTextRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);

  // Connection Handler
  const toggleConnection = () => {
    if(!meetingId.trim()) return;
    setIsConnected(!isConnected);
    setOriginalText('');
    setTranslatedText('');
    lastProcessedTextRef.current = '';
  };

  // Polling Loop
  useEffect(() => {
    let interval: any;

    if (isConnected) {
      interval = setInterval(async () => {
        const payload = await pollTranscript(meetingId);
        
        if (payload && payload.source_text !== lastProcessedTextRef.current) {
          lastProcessedTextRef.current = payload.source_text;
          setOriginalText(payload.source_text);
          handleNewContent(payload.source_text);
        }
      }, 1000); // Fast polling for "instant" feel
    }

    return () => clearInterval(interval);
  }, [isConnected, meetingId]);

  // Translation & TTS Logic
  const handleNewContent = async (text: string) => {
    // 1. Translate
    const translated = await translateText(text, ALL_LANGUAGES.find(l => l.code === targetLang)?.label || 'English');
    setTranslatedText(translated);

    // 2. TTS
    if (ttsEnabled && translated) {
       playTTS(translated);
    }
  };

  const playTTS = async (text: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Find the full provider object based on current selected value
    const providerConfig = TTS_PROVIDERS.find(p => p.value === ttsProviderValue) || TTS_PROVIDERS[0];

    // Pass provider ID and Voice to service
    const audioData = await generateSpeech(text, providerConfig.id, providerConfig.voice);
    
    if (audioData) {
      const ctx = audioContextRef.current;
      try {
        const audioBuffer = await ctx.decodeAudioData(audioData);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch (e) {
        console.error("Audio decode failed", e);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in max-w-lg mx-auto w-full">
      {/* Input Meeting ID Header */}
      <div className="flex gap-2 w-full">
        <input 
          type="text" 
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
          disabled={isConnected}
          placeholder="Enter Broadcast ID..."
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-center font-mono text-accent w-full focus:outline-none focus:border-accent placeholder:text-gray-700 transition-all"
        />
        <button 
          onClick={toggleConnection}
          className={`px-5 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors
            ${isConnected 
              ? 'bg-danger/20 text-danger border border-danger/50' 
              : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}
        >
          {isConnected ? 'Stop' : 'Join'}
        </button>
      </div>

      {/* Minimal Settings Row */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <select 
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="bg-card border border-white/10 rounded-lg py-2 px-3 text-xs text-gray-300 focus:border-accent focus:outline-none flex-grow"
        >
           {ALL_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        
        <select 
          value={ttsProviderValue}
          onChange={(e) => setTtsProviderValue(e.target.value)}
          className="bg-card border border-white/10 rounded-lg py-2 px-3 text-xs text-gray-300 focus:border-accent focus:outline-none w-28"
        >
           {TTS_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <button
          onClick={() => setTtsEnabled(!ttsEnabled)}
          className={`px-3 rounded-lg text-xs font-bold uppercase border transition-all whitespace-nowrap
            ${ttsEnabled 
              ? 'bg-accent/20 border-accent text-accent' 
              : 'bg-transparent border-white/10 text-gray-600'}`}
        >
           TTS
        </button>
      </div>

      {/* Instant Content Box */}
      <div className="relative mt-2">
         {/* Original Text Component Box */}
         <div className="mb-2 p-3 rounded-lg border-l-2 border-gray-800 bg-black/20 min-h-[60px]">
           <span className="text-[9px] uppercase text-gray-600 block mb-1">Incoming Audio Stream</span>
           {originalText ? (
             <p className="text-gray-400 text-sm leading-snug animate-fade-in">{originalText}</p>
           ) : (
             <p className="text-gray-800 text-xs italic">Waiting for broadcast...</p>
           )}
         </div>

         {/* Translated Text Main Display */}
         <div className="bg-[#030408] border border-white/10 rounded-2xl p-6 min-h-[300px] flex flex-col justify-center text-center relative overflow-hidden shadow-2xl">
            {!translatedText && (
               <div className="absolute inset-0 flex items-center justify-center text-gray-800 text-xs uppercase tracking-widest pointer-events-none">
                  {isConnected ? 'Listening...' : 'Ready to Translate'}
               </div>
            )}
            
            {translatedText && (
               <p className="text-white text-xl md:text-2xl font-light leading-relaxed animate-fade-in-up selection:bg-accent selection:text-black">
                 {translatedText}
               </p>
            )}

            {/* Audio Visualizer Decoration */}
            {isConnected && translatedText && (
               <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 h-3 items-end">
                  <div className="w-1 bg-accent/50 rounded-full animate-[pulse_1s_ease-in-out_infinite] h-full"></div>
                  <div className="w-1 bg-accent/50 rounded-full animate-[pulse_1.2s_ease-in-out_infinite] h-2/3"></div>
                  <div className="w-1 bg-accent/50 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-full"></div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Translator;