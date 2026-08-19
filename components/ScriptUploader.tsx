'use client';

import React, { useState, useRef } from 'react';
import mammoth from 'mammoth';
import { Upload, FileText, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ScriptUploaderProps {
  onSuccess?: (storyId: string) => void;
}

export default function ScriptUploader({ onSuccess }: ScriptUploaderProps) {
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    
    // Auto populate title if title field is empty
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }

    try {
      if (file.name.endsWith('.docx')) {
        setStatusMessage('Membaca berkas Word (.docx)...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setRawText(result.value);
        setStatusMessage('Berkas .docx berhasil dibaca.');
      } else if (file.name.endsWith('.txt')) {
        setStatusMessage('Membaca berkas teks (.txt)...');
        const text = await file.text();
        setRawText(text);
        setStatusMessage('Berkas .txt berhasil dibaca.');
      } else {
        setError('Format berkas tidak didukung. Harap gunakan .docx atau .txt');
      }
    } catch (err: any) {
      setError(`Gagal membaca berkas: ${err?.message || 'Format tidak valid'}`);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !rawText.trim()) {
      setError('Judul cerita dan naskah wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(15);
    setStatusMessage('Mengirim naskah ke Gemini API untuk ekstraksi karakter & segmen...');

    try {
      const progressTimer = setInterval(() => {
        setProgress((prev) => (prev < 90 ? prev + 10 : prev));
      }, 500);

      const res = await fetch('/api/parse-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, rawText }),
      });

      clearInterval(progressTimer);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses naskah cerita.');
      }

      setProgress(100);
      setStatusMessage(`Berhasil! ${data.segmentsCount} segmen telah diparsing.`);

      setTimeout(() => {
        if (onSuccess) {
          onSuccess(data.storyId);
        } else {
          window.location.href = `/stories/${data.storyId}`;
        }
      }, 800);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan saat memproses naskah.');
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-purple-950/20 text-slate-100">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold bg-linear-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
            Buat Storyteller AI Baru
          </h2>
          <p className="text-sm text-slate-400">
            Unggah naskah dongeng/cerita (.docx, .txt) atau ketik langsung untuk analisis multi-karakter audio.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start space-x-3 text-rose-300 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Judul Cerita / Dongeng
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Petualangan Kancil & Sang Serigala Bijak"
            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition"
            disabled={loading}
          />
        </div>

        {/* Drag and Drop Zone */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Unggah Dokumen Naskah (.docx / .txt)
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center space-y-2 ${
              isDragOver
                ? 'border-purple-400 bg-purple-500/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/80'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".docx,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="p-3 bg-slate-800/60 rounded-full text-purple-400 mb-1">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              {fileName ? (
                <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> {fileName}
                </span>
              ) : (
                'Tarik & lepas file naskah di sini, atau klik untuk memilih file'
              )}
            </p>
            <p className="text-xs text-slate-500">Mendukung format .docx dan .txt</p>
          </div>
        </div>

        {/* Raw text input textarea */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Atau Ketik / Edit Naskah Langsung
          </label>
          <textarea
            rows={7}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Tulis atau tempel naskah cerita di sini...
Contoh format:
Narrator: Di sebuah rimba tua yang rindang, malam merayap pelan.
Sang Kancil: Wahai Serigala, maukah engkau mendengarkan dongeng bintang?
Serigala: (Berbisik) Katakan, sahabatku..."
            className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition font-mono text-sm leading-relaxed"
            disabled={loading}
          />
        </div>

        {/* Progress Bar & Status */}
        {loading && (
          <div className="space-y-3 p-4 bg-slate-950/80 border border-purple-500/30 rounded-2xl animate-fade-in">
            <div className="flex justify-between items-center text-xs font-medium text-purple-300">
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{statusMessage}</span>
              </span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-linear-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 bg-linear-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:via-pink-500 hover:to-amber-400 text-white font-semibold rounded-2xl shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center space-x-2 text-base"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Memproses Naskah dengan Gemini AI...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Analisis & Parse Naskah AI</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
