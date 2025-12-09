import React, { useState } from 'react';
import { Tab } from './types';
import Broadcaster from './components/Broadcaster';
import Translator from './components/Translator';
import { nanoid } from 'nanoid';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.BROADCASTER);
  // Generate a random ID for this session if the user decides to broadcast
  const [sessionMeetingId] = useState<string>(nanoid(10));

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      
      <div className="w-full max-w-5xl bg-[#060b16]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative">
        
        {/* Decorative Glows */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3"></div>

        {/* Header */}
        <header className="px-6 py-5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white to-accent shadow-[0_0_15px_rgba(0,224,255,0.5)] relative overflow-hidden">
               <div className="absolute inset-[2px] bg-black rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
               </div>
            </div>
            <div className="leading-none">
              <h1 className="text-lg font-bold tracking-[0.2em] text-white uppercase">Orbit & Eburon</h1>
              <p className="text-[10px] text-accent/80 tracking-widest uppercase">Live Translation Lab</p>
            </div>
          </div>

          <nav className="flex bg-black/40 p-1 rounded-full border border-white/10">
            <button
              onClick={() => setActiveTab(Tab.BROADCASTER)}
              className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300
                ${activeTab === Tab.BROADCASTER 
                  ? 'bg-accent text-black shadow-[0_0_15px_rgba(0,224,255,0.4)]' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              Broadcaster
            </button>
            <button
              onClick={() => setActiveTab(Tab.TRANSLATOR)}
              className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300
                ${activeTab === Tab.TRANSLATOR 
                  ? 'bg-accent text-black shadow-[0_0_15px_rgba(0,224,255,0.4)]' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              Translator
            </button>
          </nav>
        </header>

        {/* Content Area */}
        <main className="p-6 relative z-10 min-h-[500px]">
          {activeTab === Tab.BROADCASTER ? (
            <Broadcaster meetingId={sessionMeetingId} />
          ) : (
            <Translator />
          )}
        </main>
        
        {/* Footer */}
        <footer className="px-6 py-3 border-t border-white/5 text-[10px] text-gray-600 flex justify-between uppercase tracking-widest z-10 bg-black/20">
          <span>Powered by Gemini 2.5 Flash Lite & Cartesia Sonic</span>
          <span>v2.1.0-Orbit</span>
        </footer>

      </div>
    </div>
  );
};

export default App;