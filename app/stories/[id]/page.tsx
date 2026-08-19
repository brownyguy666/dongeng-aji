'use client';

import React, { useEffect, useState, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DualAudioPlayer, { CharacterInfo, SegmentInfo } from '@/components/DualAudioPlayer';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StoryDetailPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const storyId = resolvedParams.id;

  const [story, setStory] = useState<{ title: string; ambient_mood: string } | null>(null);
  const [characters, setCharacters] = useState<CharacterInfo[]>([]);
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const isGeneratingRef = useRef(false);

  // Fetch story data from Supabase
  const loadStoryData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: storyData, error: storyErr } = await supabase
        .from('stories')
        .select('title, ambient_mood')
        .eq('id', storyId)
        .single();

      if (storyErr || !storyData) {
        throw new Error(`Cerita tidak ditemukan (${storyErr?.message || ''})`);
      }
      setStory(storyData);

      const { data: charData } = await supabase
        .from('story_characters')
        .select('character_name, base_voice, pitch, rate')
        .eq('story_id', storyId);

      setCharacters((charData as CharacterInfo[]) || []);

      const { data: segData, error: segErr } = await supabase
        .from('story_segments')
        .select('*')
        .eq('story_id', storyId)
        .order('sequence_order', { ascending: true });

      if (segErr) {
        throw new Error(`Gagal memuat segmen cerita: ${segErr.message}`);
      }

      setSegments((segData as SegmentInfo[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data cerita';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  const handleDeleteStory = async () => {
    if (!confirm('Apakah kamu yakin ingin menghapus cerita ini beserta semua data dan file audionya?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/delete-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      });

      if (res.ok) {
        router.push('/');
      } else {
        alert('Gagal menghapus cerita.');
        setIsDeleting(false);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Terjadi kesalahan saat menghapus cerita.');
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    const loadInitialData = async () => {
      try {
        const { data: storyData, error: storyErr } = await supabase
          .from('stories')
          .select('title, ambient_mood')
          .eq('id', storyId)
          .single();

        if (storyErr || !storyData) {
          throw new Error(`Cerita tidak ditemukan (${storyErr?.message || ''})`);
        }

        const { data: charData } = await supabase
          .from('story_characters')
          .select('character_name, base_voice, pitch, rate')
          .eq('story_id', storyId);

        const { data: segData, error: segErr } = await supabase
          .from('story_segments')
          .select('*')
          .eq('story_id', storyId)
          .order('sequence_order', { ascending: true });

        if (segErr) {
          throw new Error(`Gagal memuat segmen cerita: ${segErr.message}`);
        }

        if (isSubscribed) {
          setStory(storyData);
          setCharacters((charData as CharacterInfo[]) || []);
          setSegments((segData as SegmentInfo[]) || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : 'Gagal memuat data cerita';
          setError(msg);
          setLoading(false);
        }
      }
    };

    if (storyId) {
      loadInitialData();
    }

    return () => {
      isSubscribed = false;
    };
  }, [storyId]);

  // High-Efficiency Concurrent & Priority Audio Generation Pipeline
  useEffect(() => {
    if (segments.length === 0 || isGeneratingRef.current) return;

    const pendingSegments = segments.filter(
      (s) => s.status === 'pending' || !s.audio_url
    );

    if (pendingSegments.length === 0) return;

    isGeneratingRef.current = true;
    let isSubscribed = true;

    const generateSegmentWorker = async (seg: SegmentInfo) => {
      if (!isSubscribed) return;

      setSegments((prev) =>
        prev.map((s) => (s.id === seg.id ? { ...s, status: 'generating' } : s))
      );

      try {
        const res = await fetch('/api/generate-segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentId: seg.id }),
        });

        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setSegments((prev) =>
              prev.map((s) =>
                s.id === seg.id
                  ? { ...s, audio_url: data.audioUrl, status: 'ready' }
                  : s
              )
            );
          }
        } else {
          if (isSubscribed) {
            setSegments((prev) =>
              prev.map((s) => (s.id === seg.id ? { ...s, status: 'error' } : s))
            );
          }
        }
      } catch (err) {
        console.warn('Async segment generation failed:', err);
      } finally {
        if (isSubscribed) {
          setGeneratingCount((prev) => Math.max(0, prev - 1));
        }
      }
    };

    const runParallelPipeline = async () => {
      setGeneratingCount(pendingSegments.length);

      // Concurrency pool with 2 workers
      const concurrency = 2;
      const queue = [...pendingSegments];

      const runWorker = async () => {
        while (queue.length > 0 && isSubscribed) {
          const item = queue.shift();
          if (item) {
            await generateSegmentWorker(item);
          }
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () =>
        runWorker()
      );

      await Promise.all(workers);
      isGeneratingRef.current = false;
    };

    runParallelPipeline();

    return () => {
      isSubscribed = false;
      isGeneratingRef.current = false;
    };
  }, [segments]);

  // Single segment generation trigger callback
  const handleGenerateSegment = useCallback(async (segmentId: string): Promise<string | null> => {
    try {
      setSegments((prev) =>
        prev.map((s) => (s.id === segmentId ? { ...s, status: 'generating' } : s))
      );

      const res = await fetch('/api/generate-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentId }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? { ...s, audio_url: data.audioUrl, status: 'ready' }
            : s
        )
      );

      return data.audioUrl;
    } catch (err) {
      console.error('Manual generate segment error:', err);
      return null;
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-purple-500 selection:text-white relative overflow-hidden pb-16">
      {/* Background Aesthetic Lighting */}
      <div className="absolute top-0 right-1/4 w-200 h-100 bg-purple-900/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-200 h-100 bg-pink-900/15 blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between relative z-10 border-b border-slate-800/60">
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-sm font-semibold text-slate-400 hover:text-purple-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Beranda</span>
        </Link>

        <div className="flex items-center space-x-3">
          {generatingCount > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-300 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sintesis Paralel ({generatingCount} sisa)...</span>
            </div>
          )}

          <button
            onClick={loadStoryData}
            className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleDeleteStory}
            disabled={isDeleting}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-500/10 rounded-xl text-slate-400 hover:text-rose-400 transition"
            title="Hapus Cerita Ini"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            <p className="text-slate-400 font-medium">Memuat Sandiwara Cerita AI...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto p-8 bg-rose-500/10 border border-rose-500/30 rounded-3xl text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-lg font-bold text-rose-200">Gagal Memuat Cerita</h3>
            <p className="text-sm text-rose-300/80">{error}</p>
            <Link
              href="/"
              className="inline-block px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-2xl text-sm transition"
            >
              Kembali
            </Link>
          </div>
        ) : story ? (
          <DualAudioPlayer
            storyTitle={story.title}
            ambientMood={story.ambient_mood}
            characters={characters}
            segments={segments}
            onGenerateSegment={handleGenerateSegment}
          />
        ) : null}
      </div>
    </main>
  );
}
