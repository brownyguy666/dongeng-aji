'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Radio,
  CheckCircle2,
  Loader2,
  ListMusic,
} from 'lucide-react';

export interface CharacterInfo {
  character_name: string;
  base_voice: string;
  pitch: string;
  rate: string;
}

export interface SegmentInfo {
  id: string;
  sequence_order: number;
  speaker_name: string;
  dialogue_text: string;
  tone?: string;
  audio_url?: string | null;
  status: 'pending' | 'generating' | 'ready' | 'error';
}

interface DualAudioPlayerProps {
  storyTitle: string;
  ambientMood: string;
  characters: CharacterInfo[];
  segments: SegmentInfo[];
  onGenerateSegment?: (segmentId: string) => Promise<string | null>;
}

const AMBIENT_TITLES: Record<string, string> = {
  forest_night: '🌲 Hutan Malam Sunyi',
  rainy_day: '🌧️ Hujan Rintik Syahdu',
  tavern_crowd: '🍺 Kedai Hangat & Perapian',
  medieval_castle: '🏰 Istana Kerajaan Megah',
  calm_room: '📖 Kamar Dongeng Tenang',
};

export default function DualAudioPlayer({
  storyTitle,
  ambientMood,
  characters,
  segments,
  onGenerateSegment,
}: DualAudioPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);
  const [isDucked, setIsDucked] = useState(false);
  const [isGeneratingCurrent, setIsGeneratingCurrent] = useState(false);

  // Audio Elements Ref
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

  const currentSegment = segments[currentIndex] || null;

  // Find character voice info
  const speakerChar = characters.find(
    (c) => c.character_name.toLowerCase() === currentSegment?.speaker_name?.toLowerCase()
  );

  // Initialize Ambient Audio Channel
  useEffect(() => {
    const mood = ambientMood || 'forest_night';
    const audio = new Audio(`/audio/ambient/${mood}.mp3`);
    audio.loop = true;
    audio.volume = isMuted ? 0 : isDucked ? 0.10 : ambientVolume;
    ambientAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [ambientMood, isMuted, isDucked, ambientVolume]);

  // Sync Ambient Volume with Auto-Ducking
  useEffect(() => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.volume = isMuted ? 0 : isDucked ? 0.10 : ambientVolume;
    }
  }, [ambientVolume, isMuted, isDucked]);

  // Scroll active segment into view in the transcript list
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  // Handle Play / Pause Voice Audio and Segment Audio Transition
  useEffect(() => {
    if (!currentSegment) return;

    // Trigger on-demand generation asynchronously if audio_url is missing
    if (!currentSegment.audio_url && onGenerateSegment && currentSegment.status !== 'generating') {
      const segId = currentSegment.id;
      Promise.resolve().then(() => {
        setIsGeneratingCurrent(true);
        onGenerateSegment(segId)
          .then(() => setIsGeneratingCurrent(false))
          .catch(() => setIsGeneratingCurrent(false));
      });
    }

    if (currentSegment.audio_url) {
      const audio = voiceAudioRef.current;
      if (!audio) return;

      // Update source
      if (audio.src !== currentSegment.audio_url) {
        audio.src = currentSegment.audio_url;
        audio.load();
      }

      if (isPlaying) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsDucked(true);
              if (ambientAudioRef.current && !isMuted) {
                ambientAudioRef.current.play().catch(() => {});
              }
            })
            .catch((err) => {
              console.warn('Playback interrupted or autoplay prevented:', err);
            });
        }
      }
    }
  }, [currentIndex, currentSegment, isPlaying, isMuted, onGenerateSegment]);

  const togglePlayPause = () => {
    const audio = voiceAudioRef.current;
    if (!audio) return;

    if (!isPlaying) {
      setIsPlaying(true);

      // Play Ambient BGM
      if (ambientAudioRef.current && !isMuted) {
        ambientAudioRef.current.play().catch(() => {});
      }

      // Play Voice Audio
      if (currentSegment?.audio_url) {
        audio.play().catch((err) => console.warn('Play error:', err));
        setIsDucked(true);
      }
    } else {
      setIsPlaying(false);
      audio.pause();
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
      }
      setIsDucked(false);
    }
  };

  const handleVoiceEnded = () => {
    setIsDucked(false);

    // Continuous Playback: Automatically move to next segment
    if (currentIndex < segments.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsPlaying(false);
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
      }
    }
  };

  const handleVoicePlay = () => {
    setIsDucked(true);
  };

  const handleVoicePause = () => {
    setIsDucked(false);
  };

  const handleNext = () => {
    if (currentIndex < segments.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 text-slate-100">
      {/* Hidden Native HTML Audio Element for Voice Channel */}
      <audio
        ref={voiceAudioRef}
        onEnded={handleVoiceEnded}
        onPlay={handleVoicePlay}
        onPause={handleVoicePause}
        preload="auto"
      />

      {/* Active Stage & Player Hero */}
      <div className="relative bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-purple-950/30 overflow-hidden">
        {/* Ambient Mood Glow Background */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Story Title & Ambient Tag */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800/80">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs font-semibold text-purple-300 mb-2">
              <Radio className="w-3.5 h-3.5 animate-pulse text-purple-400" />
              <span>Multi-Character AI Storytelling</span>
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold bg-linear-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
              {storyTitle}
            </h1>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-2 text-xs font-medium text-amber-300 shadow-sm">
            <Music className="w-4 h-4 text-amber-400" />
            <span>Suasana: {AMBIENT_TITLES[ambientMood] || ambientMood}</span>
          </div>
        </div>

        {/* Current Active Speaker & Script Card */}
        {currentSegment ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/20">
                  {currentSegment.speaker_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-lg text-slate-100">
                      {currentSegment.speaker_name}
                    </span>
                    {currentSegment.tone && (
                      <span className="px-2.5 py-0.5 bg-pink-500/10 border border-pink-500/20 rounded-md text-xs font-medium text-pink-300">
                        Nada: {currentSegment.tone}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    Segmen {currentIndex + 1} dari {segments.length}
                    {speakerChar && (
                      <span className="ml-2 text-purple-400">
                        • Tokoh: {speakerChar.character_name}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Status Indicator */}
              <div>
                {currentSegment.audio_url ? (
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Audio Siap</span>
                  </span>
                ) : isGeneratingCurrent || currentSegment.status === 'generating' ? (
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-medium animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sintesis ElevenLabs...</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-medium">
                    <span>Menunggu...</span>
                  </span>
                )}
              </div>
            </div>

            {/* Subtitle / Dialogue Display */}
            <div className="p-6 bg-slate-950/70 border border-slate-800/80 rounded-2xl min-h-30 flex items-center justify-center text-center shadow-inner">
              <p className="text-lg md:text-xl font-medium leading-relaxed text-slate-100 italic">
                &ldquo;{currentSegment.dialogue_text}&rdquo;
              </p>
            </div>

            {/* Playback Controls Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
              {/* Main Play / Prev / Next */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl text-slate-200 transition"
                  title="Segmen Sebelumnya"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={togglePlayPause}
                  className="w-16 h-16 bg-linear-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-600/30 hover:scale-105 active:scale-95 transition duration-200"
                  title={isPlaying ? 'Jeda Cerita' : 'Putar Cerita'}
                >
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentIndex === segments.length - 1}
                  className="p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl text-slate-200 transition"
                  title="Segmen Berikutnya"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Ambient Audio Volume & Ducking Indicator */}
              <div className="flex items-center space-x-4 w-full md:w-auto bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-slate-200 transition"
                  title={isMuted ? 'Bunyikan Musik Latar' : 'Bisukan Musik Latar'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-purple-400" />}
                </button>

                <div className="flex flex-col space-y-1 flex-1 md:w-36">
                  <div className="flex justify-between items-center text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    <span>Musik Latar</span>
                    {isDucked && <span className="text-pink-400 animate-pulse">Auto-Ducking</span>}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambientVolume}
                    onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">Belum ada segmen cerita tersimpan.</div>
        )}
      </div>

      {/* Full Script Segments Transcript List */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <ListMusic className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-slate-200">Daftar Alur Naskah</h3>
          </div>
          <span className="text-xs text-slate-400">
            Klik segmen untuk langsung memutar audio dialog
          </span>
        </div>

        <div className="space-y-3 max-h-95 overflow-y-auto pr-2 custom-scrollbar">
          {segments.map((seg, idx) => {
            const isActive = idx === currentIndex;
            return (
              <div
                key={seg.id || idx}
                ref={isActive ? activeSegmentRef : null}
                onClick={() => {
                  setCurrentIndex(idx);
                  if (!isPlaying) {
                    setIsPlaying(true);
                  }
                }}
                className={`cursor-pointer p-4 rounded-2xl border transition duration-200 flex items-start space-x-4 ${
                  isActive
                    ? 'bg-purple-950/40 border-purple-500/50 shadow-lg shadow-purple-950/30'
                    : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                <div
                  className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {seg.sequence_order}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        isActive ? 'text-purple-300' : 'text-slate-300'
                      }`}
                    >
                      {seg.speaker_name}
                    </span>
                    {seg.tone && (
                      <span className="text-[11px] text-slate-500 font-medium italic">
                        {seg.tone}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      isActive ? 'text-slate-100 font-medium' : 'text-slate-400'
                    }`}
                  >
                    {seg.dialogue_text}
                  </p>
                </div>

                <div className="shrink-0 pt-1">
                  {seg.audio_url ? (
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" title="Audio Siap" />
                  ) : seg.status === 'generating' ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-700" title="Belum Di-generate" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
