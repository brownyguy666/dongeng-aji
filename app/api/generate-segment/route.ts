import { NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// Helper sanitizer to strip stage directions in parentheses/brackets so TTS speaks purely clean, expressive dialogue
function sanitizeTextForTTS(rawDialogue: string): string {
  if (!rawDialogue) return '...';
  return rawDialogue
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { segmentId } = body;

    if (!segmentId) {
      return NextResponse.json(
        { error: 'segmentId wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Get segment details
    const { data: segment, error: segError } = await supabaseAdmin
      .from('story_segments')
      .select('*')
      .eq('id', segmentId)
      .single();

    if (segError || !segment) {
      return NextResponse.json(
        { error: `Segmen tidak ditemukan: ${segError?.message || ''}` },
        { status: 404 }
      );
    }

    // 2. Fetch character voice settings
    const { data: character } = await supabaseAdmin
      .from('story_characters')
      .select('*')
      .eq('story_id', segment.story_id)
      .eq('character_name', segment.speaker_name)
      .maybeSingle();

    // Map restricted/library voices to guaranteed Free-tier 200 OK ElevenLabs voices
    const validVoiceMap: Record<string, string> = {
      '21m00Tcm4TlvDq8ikWAM': 'EXAVITQu4vr4xnSDxMaL', // Rachel (Paid) -> Bella (Free OK)
      'TxGEeevoooWoh943wDQ1': 'IKne3meq5aSn9XLyUdCD', // Josh -> Charlie (Free OK)
      'MF3mGyEYCl7XYWbV9V6O': 'EXAVITQu4vr4xnSDxMaL', // Elli -> Bella (Free OK)
      'AZnzlk1XvdvUeBnXmlld': 'ErXwobaYiN019PkySvjV', // Domi (Paid) -> Antoni (Free OK)
    };

    let voice = character?.base_voice || 'IKne3meq5aSn9XLyUdCD';
    if (validVoiceMap[voice]) {
      voice = validVoiceMap[voice];
    } else if (voice.includes('-')) {
      voice = 'IKne3meq5aSn9XLyUdCD';
    }

    const pitch = character?.pitch || '+0Hz';
    const rate = character?.rate || '+0%';
    const rawText = segment.dialogue_text || '...';
    
    // Sanitize text to remove (Berbisik), [Gembira], etc.
    const cleanedText = sanitizeTextForTTS(rawText);

    let mp3Buffer: Buffer | null = null;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    // 3. ElevenLabs API Synthesis with Pure Cleaned Text & Expressive Settings
    if (elevenLabsApiKey && elevenLabsApiKey !== 'your-elevenlabs-api-key') {
      try {
        console.log(`Generating audio with ElevenLabs API (Voice ID: ${voice}, Cleaned Text: "${cleanedText}")...`);

        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'xi-api-key': elevenLabsApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: cleanedText,
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.35,
                similarity_boost: 0.75,
                style: 0.30,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          mp3Buffer = Buffer.from(arrayBuffer);
          console.log(`ElevenLabs audio generated successfully (${mp3Buffer.length} bytes).`);
        } else {
          const errText = await response.text();
          console.warn(`ElevenLabs API returned ${response.status}: ${errText}. Falling back to Edge TTS...`);
        }
      } catch (elevenErr) {
        console.warn('ElevenLabs API call error, falling back to Edge TTS:', elevenErr);
      }
    }

    // Fallback to msedge-tts if ElevenLabs key is not set or failed
    if (!mp3Buffer) {
      const fallbackVoice = voice.includes('-') ? voice : 'id-ID-ArdiNeural';
      const tts = new MsEdgeTTS();
      await tts.setMetadata(
        fallbackVoice,
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
      );

      const { audioStream } = tts.toStream(cleanedText, { pitch, rate });
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      mp3Buffer = Buffer.concat(chunks);
    }

    // 4. Upload to Supabase Storage
    const storagePath = `stories/${segment.story_id}/seg_${segment.sequence_order}.mp3`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('story-audio')
      .upload(storagePath, mp3Buffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase Storage Upload Error:', uploadError);
      const base64Audio = `data:audio/mp3;base64,${mp3Buffer.toString('base64')}`;

      await supabaseAdmin
        .from('story_segments')
        .update({ audio_url: base64Audio, status: 'ready' })
        .eq('id', segmentId);

      return NextResponse.json({ audioUrl: base64Audio });
    }

    // 5. Get Public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('story-audio')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // 6. Update segment row in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('story_segments')
      .update({
        audio_url: publicUrl,
        status: 'ready',
      })
      .eq('id', segmentId);

    if (updateError) {
      console.error('Database Update Error (story_segments):', updateError);
    }

    return NextResponse.json({ audioUrl: publicUrl });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Gagal membuat sintesis audio segmen.';
    console.error('Generate Segment API Error:', error);
    return NextResponse.json(
      { error: errMessage },
      { status: 500 }
    );
  }
}
