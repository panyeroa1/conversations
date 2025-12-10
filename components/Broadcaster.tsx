import React, { useState, useEffect, useRef } from 'react';
import { AudioSource, Language } from '../types';
import { ALL_LANGUAGES } from '../constants';
import { uploadTranscript } from '../services/supabase';
import { transcribeAudio } from '../services/gemini';

interface BroadcasterProps {
  meetingId: string;
}

const Broadcaster: React.FC<BroadcasterProps> = ({ meetingId }) => {
  const [isLive, setIsLive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [sourceLang, setSourceLang] = useState<string>('en-US');
  const [audioSource, setAudioSource] = useState<AudioSource>(AudioSource.MIC);
  const [lastSaved, setLastSaved] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  // Device handling
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load Audio Devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }); 
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(inputs);
        if (inputs.length > 0) setSelectedDeviceId(inputs[0].deviceId);
      } catch (e) {
        console.error("Error fetching devices", e);
      }
    };
    getDevices();
  }, []);

  // Check API Key on mount
  useEffect(() => {
    import('../constants').then(({ GEMINI_API_KEY }) => {
      if (!GEMINI_API_KEY) {
        console.error('[Broadcaster] GEMINI_API_KEY is not set! Screen/tab transcription will not work.');
        console.error('[Broadcaster] Please set VITE_GEMINI_API_KEY in your .env file');
      } else {
        console.log('[Broadcaster] GEMINI_API_KEY is configured');
      }
    });
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = sourceLang;

      recognitionRef.current.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
          else interimTrans += event.results[i][0].transcript;
        }
        const currentText = (finalTrans + ' ' + interimTrans).trim();
        if(currentText) setTranscript(currentText);
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error === 'not-allowed') setIsLive(false);
      };
      recognitionRef.current.onend = () => {
        if (isLive) try { recognitionRef.current.start(); } catch (e) { setIsLive(false); }
      };
    }
  }, [sourceLang, isLive]);

  // Handle Start/Stop
  const toggleBroadcast = async () => {
    if (isLive) {
      // Stop broadcast
      setIsLive(false);
      
      // Stop Web Speech API if active
      recognitionRef.current?.stop();
      
      // Stop MediaRecorder if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop all stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    } else {
      // Start broadcast
      console.log('[Broadcaster] Starting broadcast...', { audioSource, sourceLang });
      try {
        if (audioSource === AudioSource.SCREEN || audioSource === AudioSource.TAB) {
          // For screen/tab audio: use getDisplayMedia + MediaRecorder + Gemini transcription
          console.log('[Broadcaster] Requesting display media...');
          
          try {
            streamRef.current = await navigator.mediaDevices.getDisplayMedia({ 
              video: true, 
              audio: true 
            });
            console.log('[Broadcaster] Display media granted', streamRef.current);
          } catch (displayError: any) {
            console.error('[Broadcaster] getDisplayMedia failed:', displayError);
            alert(`Screen sharing failed: ${displayError.message || displayError}\n\nPlease make sure to:\n1. Allow screen sharing permission\n2. Select "Share audio" checkbox\n3. Use Chrome or Edge browser`);
            return;
          }
          
          if (videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
          }
          
          // Get audio track from display media
          const audioTrack = streamRef.current.getAudioTracks()[0];
          if (!audioTrack) {
            alert("No audio track found in the selected screen/tab.\n\nPlease ensure:\n1. The tab/screen has audio playing\n2. 'Share audio' checkbox is checked in the sharing dialog");
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            return;
          }
          
          console.log('[Broadcaster] Audio track found:', audioTrack.label);
          
          // Create a new MediaStream with only the audio track
          const audioStream = new MediaStream([audioTrack]);
          
          // Set up MediaRecorder for audio capture
          const options = { mimeType: 'audio/webm' };
          mediaRecorderRef.current = new MediaRecorder(audioStream, options);
          audioChunksRef.current = [];
          
          mediaRecorderRef.current.ondataavailable = async (event) => {
            if (event.data.size > 0) {
              // Process each chunk directly (no accumulation needed with timeslice)
              const audioBlob = event.data;
              
              console.log('[Broadcaster] Audio chunk captured:', {
                size: audioBlob.size,
                type: audioBlob.type,
                sizeKB: (audioBlob.size / 1024).toFixed(2) + ' KB'
              });
              
              // Validate minimum size (at least 1KB to avoid empty/tiny chunks)
              if (audioBlob.size < 1000) {
                console.warn('[Broadcaster] Chunk too small, skipping transcription:', audioBlob.size, 'bytes');
                return;
              }
              
              try {
                console.log('[Broadcaster] Sending audio to Gemini for transcription...');
                const transcribedText = await transcribeAudio(audioBlob);
                
                if (transcribedText && transcribedText.trim()) {
                  console.log('[Broadcaster] ✓ Transcription received:', transcribedText);
                  setTranscript(prev => {
                    const newText = prev ? prev + ' ' + transcribedText : transcribedText;
                    return newText.trim();
                  });
                } else {
                  console.warn('[Broadcaster] ⚠ Empty transcription returned from Gemini');
                }
              } catch (transcribeError: any) {
                console.error('[Broadcaster] ✗ Transcription error:', {
                  error: transcribeError,
                  message: transcribeError?.message || 'Unknown error',
                  blobSize: audioBlob.size
                });
                // Show user-visible error for API failures
                if (transcribeError?.message?.includes('API key') || transcribeError?.message?.includes('401')) {
                  alert('Transcription failed: Invalid or missing Gemini API key. Please check your .env file.');
                }
              }
            }
          };
          
          mediaRecorderRef.current.onerror = (event: any) => {
            console.error('[Broadcaster] MediaRecorder error:', event.error);
          };
          
          mediaRecorderRef.current.onstop = () => {
            console.log('[Broadcaster] MediaRecorder stopped');
          };
          
          // Start recording with time slices (every 3 seconds)
          mediaRecorderRef.current.start(3000);
          console.log('[Broadcaster] MediaRecorder started for screen/tab audio');
          
        } else {
          // For microphone: use Web Speech API (existing behavior)
          const constraints: MediaStreamConstraints = {
            audio: selectedDeviceId ? { deviceId: selectedDeviceId } : true
          };
          streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
          
          recognitionRef.current.lang = sourceLang;
          recognitionRef.current.start();
          console.log('[Broadcaster] Web Speech API started for microphone');
        }
        
        setIsLive(true);
        console.log('[Broadcaster] Broadcast started successfully');
      } catch (err: any) {
        console.error('[Broadcaster] Start error:', err);
        alert(`Broadcast failed: ${err.message || err}\n\nPlease check:\n1. Browser permissions\n2. Microphone/audio access\n3. Console for detailed errors`);
      }
    }
  };

  // Sync loop
  useEffect(() => {
    let interval: any;
    if (isLive) {
      interval = setInterval(async () => {
        const textToSave = transcript.trim();
        if (textToSave && textToSave !== lastSaved) {
          await uploadTranscript(meetingId, textToSave, sourceLang);
          setLastSaved(textToSave);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isLive, transcript, lastSaved, meetingId, sourceLang]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-lg mx-auto w-full">
      
      {/* Top ID Card */}
      <div className="bg-gradient-to-r from-card to-black border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden group">
        <span className="text-[10px] uppercase text-gray-500 tracking-[0.2em] mb-2">Broadcaster ID</span>
        <div 
          onClick={copyToClipboard}
          className="font-mono text-3xl text-white tracking-wider select-all cursor-pointer hover:text-accent transition-colors flex items-center gap-2"
          title="Click to copy"
        >
          {meetingId}
          <svg className="w-4 h-4 text-gray-600 group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        
        {copied && (
           <span className="absolute bottom-2 text-[10px] text-green-400 font-bold uppercase tracking-widest animate-fade-in-up">Copied!</span>
        )}
        
        <div className="mt-2 flex items-center gap-2">
           <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}></div>
           <span className="text-[9px] uppercase tracking-wider text-gray-400">{isLive ? 'ON AIR' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <select 
          value={audioSource}
          onChange={(e) => setAudioSource(e.target.value as AudioSource)}
          disabled={isLive}
          className="bg-card border border-white/10 rounded-xl p-3 text-sm text-gray-300 focus:border-accent focus:outline-none w-full"
        >
          <option value={AudioSource.MIC}>Microphone Input</option>
          <option value={AudioSource.SCREEN}>Share Screen</option>
          <option value={AudioSource.TAB}>Share Tab</option>
        </select>

        {audioSource === AudioSource.MIC && audioDevices.length > 0 && (
           <select 
             value={selectedDeviceId}
             onChange={(e) => setSelectedDeviceId(e.target.value)}
             disabled={isLive}
             className="bg-card border border-white/10 rounded-xl p-3 text-sm text-gray-300 focus:border-accent focus:outline-none w-full"
           >
              {audioDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0,4)}...`}</option>
              ))}
           </select>
        )}
        
        <select 
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          disabled={isLive}
          className="bg-card border border-white/10 rounded-xl p-3 text-sm text-gray-300 focus:border-accent focus:outline-none w-full"
        >
           {ALL_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>

        <button
          onClick={toggleBroadcast}
          className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all duration-300 shadow-lg
            ${isLive 
              ? 'bg-danger text-black hover:bg-danger/90' 
              : 'bg-accent text-black hover:bg-accent/90'
            }`}
        >
           {isLive ? 'Stop Broadcast' : 'Start Broadcast'}
        </button>
      </div>

      {/* Preview/Logs */}
      {(audioSource === AudioSource.SCREEN || audioSource === AudioSource.TAB) && (
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video">
           <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
        </div>
      )}

      {/* Minimal Log */}
      <div className="bg-black/40 rounded-xl p-4 border border-white/5 h-32 overflow-hidden relative">
         <textarea
           readOnly
           value={transcript}
           className="w-full h-full bg-transparent text-gray-500 font-mono text-xs resize-none focus:outline-none"
           placeholder="Transcript will appear here..."
         />
      </div>
    </div>
  );
};

export default Broadcaster;