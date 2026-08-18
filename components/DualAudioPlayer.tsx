'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  User,
  Radio,
  Sparkles,
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
  forest_night: '🌲 Hutan Malam Sunyi & Jangkrik',
  rainy_day: '🌧️ Hujan Rintik & Gemuruh Lembut',
  tavern_crowd: '🍺 Kedai Hangat & Perapian',
  medieval_castle: '🏰 Istana Megah & Angin Dingin',
  calm_room: '📖 Kamar Dongeng Santai & Damai',
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
  const [ambientVolume, setAmbientVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isDucked, setIsDucked] = useState(false);
  const [isGeneratingCurrent, setIsGeneratingCurrent] = useState(false);

  // Audio References
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const preloadedAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const ambientNodesRef = useRef<any[]>([]);
  const activeSegmentRef = useRef<HTMLDivElement | null>(null);

  const currentSegment = segments[currentIndex] || null;

  // Find character preset
  const speakerChar = characters.find(
    (c) => c.character_name.toLowerCase() === currentSegment?.speaker_name?.toLowerCase()
  );

  // --- Professional Procedural Ambient Sound Engine ---
  const startProceduralAmbient = useCallback(() => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
        return;
      }

      if (audioCtxRef.current) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      const initialVol = isMuted ? 0 : isDucked ? 0.15 : ambientVolume;
      masterGain.gain.setValueAtTime(initialVol * 0.25, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      const nodes: any[] = [];
      const mood = ambientMood || 'forest_night';

      if (mood === 'rainy_day') {
        // Rain Noise Generator
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02; // Pink-ish noise filter
          lastOut = output[i];
          output[i] *= 3.5;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const rainFilter = ctx.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.setValueAtTime(800, ctx.currentTime);

        whiteNoise.connect(rainFilter);
        rainFilter.connect(masterGain);
        whiteNoise.start();
        nodes.push(whiteNoise, rainFilter);
      } else {
        // Multi-layered Atmospheric Harmonic Drone
        const freqs =
          mood === 'forest_night'
            ? [110, 164.81, 220] // A2, E3, A3
            : mood === 'tavern_crowd'
            ? [130.81, 196, 261.63] // C3, G3, C4
            : mood === 'medieval_castle'
            ? [98, 146.83, 196] // G2, D3, G3
            : [110, 138.59, 164.81]; // Calm warm A major

        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.15 / (idx + 1), ctx.currentTime);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start();
          nodes.push(osc, gain);
        });
      }

      ambientNodesRef.current = nodes;
    } catch (e) {
      console.warn('Ambient Web Audio Engine Error:', e);
    }
  }, [ambientMood, ambientVolume, isDucked, isMuted]);

  const stopProceduralAmbient = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend();
    }
  }, []);

  // Sync Ambient Volume with Smooth Fade Auto-Ducking
  useEffect(() => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    const targetVol = isMuted ? 0 : isDucked ? 0.15 : ambientVolume;
    const ctx = audioCtxRef.current;

    // Smooth exponential/linear gain ramp for professional studio ducking
    masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
    masterGainRef.current.gain.linearRampToValueAtTime(
      targetVol * 0.25,
      ctx.currentTime + 0.3
    );
  }, [ambientVolume, isMuted, isDucked]);

  // Preload Next Segment for Instant Gapless Continuous Playback
  useEffect(() => {
    const nextSegment = segments[currentIndex + 1];
    if (nextSegment && nextSegment.audio_url) {
      const preload = new Audio(nextSegment.audio_url);
      preload.preload = 'auto';
      preloadedAudioRef.current = preload;
    }
  }, [currentIndex, segments]);

  // Scroll active segment into view
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  // Manage Voice Audio Playback
  useEffect(() => {
    if (!currentSegment) return;

    if (!currentSegment.audio_url && onGenerateSegment && currentSegment.status !== 'generating') {
      setIsGeneratingCurrent(true);
      onGenerateSegment(currentSegment.id)
        .then(() => setIsGeneratingCurrent(false))
        .catch(() => setIsGeneratingCurrent(false));
    }

    if (currentSegment.audio_url) {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
      }

      const voice = new Audio(currentSegment.audio_url);
      voiceAudioRef.current = voice;

      voice.onplay = () => {
        setIsDucked(true); // Auto-ducking: volume down to 0.15
        startProceduralAmbient();
      };

      voice.onpause = () => {
        setIsDucked(false);
      };

      voice.onended = () => {
        setIsDucked(false); // Restore volume
        
        // Instant Continuous Playback to next segment
        if (currentIndex < segments.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          setIsPlaying(false);
          stopProceduralAmbient();
        }
      };

      if (isPlaying) {
        voice.play().catch((err) => console.warn('Voice play error:', err));
        startProceduralAmbient();
      }
    }
  }, [currentIndex, currentSegment?.audio_url, isPlaying, startProceduralAmbient, stopProceduralAmbient]);

  const togglePlayPause = async () => {
    if (!isPlaying) {
      setIsPlaying(true);
      startProceduralAmbient();

      if (voiceAudioRef.current) {
        voiceAudioRef.current.play().catch(() => {});
      }
    } else {
      setIsPlaying(false);
      stopProceduralAmbient();

      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
      }
    }
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
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-purple-200 bg-clip-text text-transparent">
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
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/20">
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
                        • Voice ID: {speakerChar.base_voice}
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
            <div className="p-6 bg-slate-950/70 border border-slate-800/80 rounded-2xl min-h-[120px] flex items-center justify-center text-center shadow-inner">
              <p className="text-lg md:text-xl font-medium leading-relaxed text-slate-100 italic">
                "{currentSegment.dialogue_text}"
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
                  className="w-16 h-16 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-600/30 hover:scale-105 active:scale-95 transition duration-200"
                  title={isPlaying ? 'Jeda Suara & Ambient' : 'Putar Cerita'}
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

              {/* Ambient Audio BGM Volume & Auto-Ducking Indicator */}
              <div className="flex items-center space-x-4 w-full md:w-auto bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-slate-200 transition"
                  title={isMuted ? 'Bunyikan Ambient' : 'Bisukan Ambient'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-purple-400" />}
                </button>

                <div className="flex flex-col space-y-1 flex-1 md:w-36">
                  <div className="flex justify-between items-center text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    <span>Volume Ambient</span>
                    {isDucked && <span className="text-pink-400 animate-pulse">Auto-Ducking (0.15)</span>}
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
            Klik segmen untuk langsung memutar audio
          </span>
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
          {segments.map((seg, idx) => {
            const isActive = idx === currentIndex;
            return (
              <div
                key={seg.id || idx}
                ref={isActive ? activeSegmentRef : null}
                onClick={() => {
                  setCurrentIndex(idx);
                  if (!isPlaying) togglePlayPause();
                }}
                className={`cursor-pointer p-4 rounded-2xl border transition duration-200 flex items-start space-x-4 ${
                  isActive
                    ? 'bg-purple-950/40 border-purple-500/50 shadow-lg shadow-purple-950/30'
                    : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/80 hover:border-slate-700'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
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

                <div className="flex-shrink-0 pt-1">
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
