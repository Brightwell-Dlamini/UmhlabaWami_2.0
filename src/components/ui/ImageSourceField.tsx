import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Link2, X } from 'lucide-react';

interface Props {
  label?: string;
  value?: string | null;
  onChange: (url: string) => void;
  onUploadFile?: (file: File) => Promise<string>;
  disabled?: boolean;
  hint?: string;
}

/** System-wide image input: upload file, paste URL, or open device camera. */
export function ImageSourceField({
  label = 'Image',
  value,
  onChange,
  onUploadFile,
  disabled,
  hint,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'upload' | 'url' | 'camera'>('upload');
  const [urlDraft, setUrlDraft] = useState(value || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (!onUploadFile) {
      onChange(URL.createObjectURL(file));
      return;
    }
    setBusy(true);
    try {
      const publicUrl = await onUploadFile(file);
      onChange(publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 text-xs">
      {label && (
        <label className="block font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'upload' as const, icon: ImagePlus, text: 'Upload' },
            { id: 'url' as const, icon: Link2, text: 'Image URL' },
            { id: 'camera' as const, icon: Camera, text: 'Camera' },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={disabled || busy}
            onClick={() => {
              setMode(m.id);
              setError('');
              if (m.id === 'upload') fileRef.current?.click();
              if (m.id === 'camera') cameraRef.current?.click();
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
              mode === m.id
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <m.icon className="w-3.5 h-3.5" />
            {m.text}
          </button>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />

      {mode === 'url' && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlDraft}
            disabled={disabled || busy}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://…"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
          />
          <button
            type="button"
            disabled={disabled || busy || !urlDraft.trim()}
            onClick={() => onChange(urlDraft.trim())}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}

      {busy && <p className="text-[10px] text-blue-600">Uploading…</p>}
      {error && <p className="text-[10px] text-red-600">{error}</p>}

      {value && (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Preview"
            className="h-20 w-20 rounded-xl object-contain border border-slate-200 dark:border-slate-700 bg-white"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange('');
              setUrlDraft('');
            }}
            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-slate-800 text-white"
            title="Remove"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
