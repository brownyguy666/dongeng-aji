'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import ScriptUploader from '@/components/ScriptUploader';
import { supabase } from '@/lib/supabase';
import { Sparkles, BookOpen, PlusCircle, Volume2, ArrowRight, PlayCircle, Loader2, Trash2 } from 'lucide-react';

interface StorySummary {
  id: string;
  title: string;
  ambient_mood: string;
  created_at: string;
}

export default function HomePage() {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stories')
        .select('id, title, ambient_mood, created_at')
        .order('created_at', { ascending: false });

      if (data && !error) {
        setStories(data as StorySummary[]);
      }
    } catch (err) {
      console.warn('Error fetching stories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStory = async (e: React.MouseEvent, storyId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Apakah kamu yakin ingin menghapus cerita ini beserta semua file audionya?')) {
      return;
    }

    setDeletingId(storyId);
    try {
      const res = await fetch('/api/delete-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      });

      if (res.ok) {
        setStories((prev) => prev.filter((s) => s.id !== storyId));
      } else {
        alert('Gagal menghapus cerita.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Terjadi kesalahan saat menghapus cerita.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-purple-500 selection:text-white relative overflow-hidden">
      {/* Dynamic Aesthetic Background Lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-250 h-125 bg-linear-to-b from-purple-900/30 via-pink-900/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -left-48 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 -right-48 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between relative z-10 border-b border-slate-800/60">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-linear-to-tr from-purple-600 to-pink-500 rounded-2xl shadow-lg shadow-purple-600/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-black bg-linear-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              Storyteller AI
            </span>
            <span className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Theatrical Radio Drama Synthesis Platform
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowUploader(!showUploader)}
          className="px-5 py-2.5 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-2xl shadow-lg shadow-purple-600/20 transition flex items-center space-x-2 text-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{showUploader ? 'Tutup Form' : 'Buat Cerita Baru'}</span>
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 relative z-10 space-y-12">
        {/* Hero Banner */}
        {!showUploader && (
          <div className="text-center space-y-6 max-w-3xl mx-auto pt-6">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs font-semibold text-purple-300">
              <Volume2 className="w-4 h-4 text-purple-400 animate-pulse" />
              <span>Theatrical AI Voice Synthesis & Procedural Ambient Soundscapes</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight bg-linear-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
              Ubah Naskah Menjadi Sandiwara Radio AI Teatrikal
            </h1>

            <p className="text-base md:text-lg text-slate-400 leading-relaxed">
              Penyutradaraan otomatis dengan karakterisasi suara, artikulasi vokal non-verbal, jeda dramatis, dan musik latar ambient interaktif.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setShowUploader(true)}
                className="px-8 py-4 bg-linear-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-bold rounded-2xl shadow-xl shadow-purple-600/30 hover:scale-105 transition duration-200 flex items-center space-x-2 text-base"
              >
                <Sparkles className="w-5 h-5" />
                <span>Mulai Buat Cerita Teatrikal</span>
              </button>
            </div>
          </div>
        )}

        {/* Uploader Section */}
        {showUploader && (
          <div className="animate-fade-in">
            <ScriptUploader onSuccess={(storyId) => (window.location.href = `/stories/${storyId}`)} />
          </div>
        )}

        {/* Existing Stories Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-bold text-slate-200">Koleksi Cerita Tersimpan</h2>
            </div>
            <span className="text-xs text-slate-400">{stories.length} cerita tersedia</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 space-x-3 text-purple-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Memuat daftar cerita...</span>
            </div>
          ) : stories.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800/80 rounded-3xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-300">Belum ada cerita yang dibuat</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Klik tombol "Buat Cerita Baru" untuk mengunggah naskah dan mengubahnya menjadi pertunjukan audio teatrikal.
              </p>
              <button
                onClick={() => setShowUploader(true)}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-2xl text-sm transition shadow-lg shadow-purple-600/20"
              >
                Buat Cerita Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story) => (
                <div
                  key={story.id}
                  className="group relative p-6 bg-slate-900/80 hover:bg-slate-900 backdrop-blur-xl border border-slate-800 hover:border-purple-500/50 rounded-3xl transition duration-300 shadow-lg shadow-purple-950/10 hover:shadow-purple-950/30 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-xs font-semibold">
                        {story.ambient_mood || 'Forest Night'}
                      </span>
                      
                      <button
                        onClick={(e) => handleDeleteStory(e, story.id)}
                        disabled={deletingId === story.id}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                        title="Hapus Cerita & Audio"
                      >
                        {deletingId === story.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <Link href={`/stories/${story.id}`} className="block">
                      <h3 className="text-lg font-bold text-slate-100 group-hover:text-purple-300 transition line-clamp-2">
                        {story.title}
                      </h3>
                      <span className="block mt-1 text-[11px] text-slate-500">
                        Dibuat: {new Date(story.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </Link>
                  </div>

                  <Link
                    href={`/stories/${story.id}`}
                    className="pt-6 flex items-center justify-between text-sm font-semibold text-purple-400 group-hover:text-purple-300 transition"
                  >
                    <span className="flex items-center space-x-1.5">
                      <PlayCircle className="w-4 h-4" />
                      <span>Putar Sandiwara Audio</span>
                    </span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition transform" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
