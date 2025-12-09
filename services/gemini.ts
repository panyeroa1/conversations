import { GoogleGenAI, Modality } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const translateText = async (text: string, targetLang: string): Promise<string> => {
  if (!text.trim()) return "";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      config: {
        // STRICT System Prompt for Natural, Read-Aloud Translation
        systemInstruction: `You are a voice translator engine. 
        Target Language: ${targetLang}
        
        Your Goal: Translate the input text strictly into natural, spoken ${targetLang}.
        
        Style Guide:
        - The translation must be phrased for a deep, resonant, professional narration (similar to Michael LeBeau style).
        - It should flow naturally as if spoken by a native speaker with gravitas.
        - Translate contextually and colloquially, NOT word-for-word.
        
        Constraints:
        - NO introductory phrases (e.g., "Here is the translation").
        - NO explanations.
        - NO markdown formatting.
        - Output ONLY the raw translated string to be read aloud immediately.`,
      },
      contents: [
        { text: text }
      ],
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Translation error:", error);
    return text; // Fallback to original
  }
};

export const generateSpeech = async (text: string, provider: string = 'gemini', voiceStyle: string = 'Fenrir'): Promise<ArrayBuffer | null> => {
  if (!text.trim()) return null;

  // --- Cartesia TTS Integration ---
  if (provider === 'cartesia') {
    try {
      const response = await fetch("https://api.cartesia.ai/tts/bytes", {
        method: "POST",
        headers: {
          "Cartesia-Version": "2024-06-10", // Using stable version for compatibility
          "X-API-Key": "sk_car_rdQTiz3FE5Eb27BmX1RDgE",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model_id: "sonic-3",
          transcript: text,
          voice: {
            mode: "id",
            id: "9aac52b6-c268-4d05-98d3-71a74bf9c044" // Specific Michael LeBeau-style voice ID
          },
          output_format: {
            container: "wav",
            encoding: "pcm_f32le",
            sample_rate: 44100
          },
          speed: "normal",
          generation_config: {
            speed: 1,
            volume: 1
          }
        })
      });

      if (!response.ok) {
        console.error("Cartesia API Error:", response.statusText);
        return null;
      }
      return await response.arrayBuffer();
    } catch (e) {
      console.error("Cartesia Fetch Error", e);
      return null;
    }
  }

  // --- Gemini TTS Integration (Fallback/Default) ---
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text }],
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceStyle },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    // Decode Base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;

  } catch (error) {
    console.error("TTS error:", error);
    return null;
  }
};