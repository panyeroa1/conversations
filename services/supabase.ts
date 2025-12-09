import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';
import { TranscriptPayload } from '../types';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const uploadTranscript = async (
  clientId: string,
  text: string,
  langCode: string
) => {
  if (!text) return;
  
  const { error } = await supabase
    .from("eburon_tts_current")
    .insert({
      client_id: clientId,
      source_text: text,
      source_lang_code: langCode,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("Supabase Error:", error);
    throw error;
  }
};

// Polling fallback since we can't easily set up Realtime channel subscriptions 
// without knowing the exact table policies/replication settings of the user's DB.
// In a production app, we would use supabase.channel().subscribe().
export const pollTranscript = async (meetingId: string): Promise<TranscriptPayload | null> => {
  const { data, error } = await supabase
    .from("eburon_tts_current")
    .select("*")
    .eq("client_id", meetingId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
};