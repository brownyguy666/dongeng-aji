import { NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface CharacterInput {
  name: string;
  gender_or_type: 'male' | 'female' | 'elder_male' | 'child' | 'narrator';
}

interface SegmentInput {
  order: number;
  speaker: string;
  tone: string;
  text: string;
}

interface ParsedStorySchema {
  ambient_mood: 'forest_night' | 'rainy_day' | 'tavern_crowd' | 'medieval_castle' | 'calm_room';
  characters: CharacterInput[];
  segments: SegmentInput[];
}

// Maps character types to 100% verified Free-tier ElevenLabs Voice IDs
function getVoicePreset(genderOrType: string) {
  switch (genderOrType) {
    case 'female':
      return { base_voice: 'EXAVITQu4vr4xnSDxMaL', pitch: '+0Hz', rate: '+0%' }; // Bella (Expressive Female)
    case 'elder_male':
      return { base_voice: 'JBFqnCBsd6RMkjVDRZzb', pitch: '-3Hz', rate: '-10%' }; // George (Deep Warm Male)
    case 'child':
      return { base_voice: 'AZnzlk1XvdvUeBnXmlld', pitch: '+5Hz', rate: '+5%' }; // Domi (Expressive Child)
    case 'male':
      return { base_voice: 'pNInz6obpgDQGcFmaJgB', pitch: '+0Hz', rate: '+0%' }; // Adam (Deep Male)
    case 'narrator':
    default:
      return { base_voice: 'IKne3meq5aSn9XLyUdCD', pitch: '-1Hz', rate: '-5%' }; // Charlie (Articulate Narrator)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, rawText } = body;

    if (!title || !rawText) {
      return NextResponse.json(
        { error: 'Judul dan isi naskah cerita wajib diisi.' },
        { status: 400 }
      );
    }

    const prompt = `Analisis naskah cerita berikut dan ekstrak struktur dramatisnya secara presisi dan ekspresif:
Judul: ${title}

Naskah:
${rawText}

Tugas:
1. Tentukan ambient_mood yang paling sesuai (pilihan persis: forest_night, rainy_day, tavern_crowd, medieval_castle, calm_room).
2. Daftarkan seluruh tokoh/karakter yang berbicara (termasuk "Narrator" jika ada narasi). Tentukan gender_or_type untuk tiap tokoh dari pilihan: male, female, elder_male, child, narrator.
3. Bagi naskah menjadi segmen-segmen dialog/narasi berurutan (sequence order mulai dari 1).
4. SANGAT PENTING - Penyusunan Tanda Baca Dramatis untuk TTS:
   - Pindahkan/hapus semua tag petunjuk emosi dalam kurung seperti "(berbisik)" atau "[gembira]" dari teks dialog 'text'.
   - Perbaiki dan susun 'text' dialog dengan tanda baca dramatis yang tepat sesuai emosi adegan:
     * Gunakan elipsis '...' untuk jeda emosional, kecemasan, atau tahan napas.
     * Gunakan tanda seru '!' untuk penekanan nada keras, kejutan, atau kemarahan.
     * Gunakan tanda hubung '--' untuk perhentian kalimat mendadak atau keraguan.
     * Gunakan koma ',' untuk ritme jeda napas yang alami.
   Hal ini sangat penting agar sintesis suara ElevenLabs menghasilkan intonasi dan penekanan ekspresi yang murni, ekspresif, dan tidak datar.`;

    let parsedResult: ParsedStorySchema;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              ambient_mood: {
                type: 'STRING',
                enum: ['forest_night', 'rainy_day', 'tavern_crowd', 'medieval_castle', 'calm_room'],
              },
              characters: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    gender_or_type: {
                      type: 'STRING',
                      enum: ['male', 'female', 'elder_male', 'child', 'narrator'],
                    },
                  },
                  required: ['name', 'gender_or_type'],
                },
              },
              segments: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    order: { type: 'INTEGER' },
                    speaker: { type: 'STRING' },
                    tone: { type: 'STRING' },
                    text: { type: 'STRING' },
                  },
                  required: ['order', 'speaker', 'tone', 'text'],
                },
              },
            },
            required: ['ambient_mood', 'characters', 'segments'],
          },
        },
      });

      const responseText = response.text || '';
      parsedResult = JSON.parse(responseText);
    } catch (geminiError: any) {
      console.warn('Gemini API call failed or missing API key, using smart heuristic fallback parser:', geminiError?.message);

      const lines = rawText
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      const fallbackSegments: SegmentInput[] = [];
      const characterSet = new Set<string>();

      lines.forEach((line: string, index: number) => {
        let speaker = 'Narrator';
        let dialogueText = line;
        let tone = 'netral';

        if (line.includes(':')) {
          const parts = line.split(':');
          speaker = parts[0].trim();
          dialogueText = parts.slice(1).join(':').trim();
        }

        characterSet.add(speaker);
        fallbackSegments.push({
          order: index + 1,
          speaker,
          tone,
          text: dialogueText,
        });
      });

      const fallbackCharacters: CharacterInput[] = Array.from(characterSet).map((name) => {
        let gender: 'male' | 'female' | 'elder_male' | 'child' | 'narrator' = 'male';
        const lower = name.toLowerCase();
        if (lower.includes('narrator') || lower.includes('narator')) gender = 'narrator';
        else if (lower.includes('putri') || lower.includes('ibu') || lower.includes('gadis') || lower.includes('ratu')) gender = 'female';
        else if (lower.includes('kakek') || lower.includes('tua')) gender = 'elder_male';
        else if (lower.includes('anak') || lower.includes('bocah')) gender = 'child';
        return { name, gender_or_type: gender };
      });

      parsedResult = {
        ambient_mood: 'forest_night',
        characters: fallbackCharacters,
        segments: fallbackSegments,
      };
    }

    // 1. Save story to Supabase
    const { data: storyData, error: storyError } = await supabaseAdmin
      .from('stories')
      .insert({
        title,
        raw_content: rawText,
        ambient_mood: parsedResult.ambient_mood || 'calm_room',
        status: 'parsed',
      })
      .select('id')
      .single();

    if (storyError || !storyData) {
      console.error('Database Error (stories):', storyError);
      return NextResponse.json(
        { error: `Gagal menyimpan cerita: ${storyError?.message}` },
        { status: 500 }
      );
    }

    const storyId = storyData.id;

    // 2. Save story characters
    const characterInserts = parsedResult.characters.map((char) => {
      const preset = getVoicePreset(char.gender_or_type);
      return {
        story_id: storyId,
        character_name: char.name,
        base_voice: preset.base_voice,
        pitch: preset.pitch,
        rate: preset.rate,
      };
    });

    if (characterInserts.length > 0) {
      const { error: charError } = await supabaseAdmin
        .from('story_characters')
        .insert(characterInserts);

      if (charError) {
        console.error('Database Error (story_characters):', charError);
      }
    }

    // 3. Save story segments
    const segmentInserts = parsedResult.segments.map((seg, idx) => ({
      story_id: storyId,
      sequence_order: seg.order || idx + 1,
      speaker_name: seg.speaker || 'Narrator',
      dialogue_text: seg.text,
      tone: seg.tone || 'netral',
      status: 'pending',
    }));

    if (segmentInserts.length > 0) {
      const { error: segError } = await supabaseAdmin
        .from('story_segments')
        .insert(segmentInserts);

      if (segError) {
        console.error('Database Error (story_segments):', segError);
        return NextResponse.json(
          { error: `Gagal menyimpan segmen cerita: ${segError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      storyId,
      segmentsCount: segmentInserts.length,
      ambientMood: parsedResult.ambient_mood,
    });
  } catch (error: any) {
    console.error('Parse Story Route Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan pada server saat memproses naskah.' },
      { status: 500 }
    );
  }
}
