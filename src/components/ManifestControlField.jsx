import React from 'react';
import {
  Sparkles,
  Lock,
  Dices,
  Upload
} from 'lucide-react';

function ManifestControlField({
  ctrl,
  val,
  onChange,
  isSeedRandom,
  onToggleSeedRandom,
  onRollRandomSeed,
  availableModels,
  uploadedPreviewUrl,
  onUploadImage,
  isUploadingImage
}) {
  switch (ctrl.component) {
    case 'textarea':
      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              {ctrl.label}
            </label>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              Node {ctrl.target_node}
            </span>
          </div>
          <textarea
            rows={ctrl.rows || 4}
            value={val || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={ctrl.description || 'Enter prompt...'}
            className="w-full bg-zinc-950 text-zinc-100 text-sm leading-relaxed rounded-xl p-3 border border-zinc-800 focus:border-emerald-500 focus:outline-none resize-y select-text"
          />
        </div>
      );

    case 'aspect_picker':
      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              {ctrl.label}
            </label>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded-md">
              {val?.width} × {val?.height}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(ctrl.presets || []).map((preset) => {
              const isSelected = val?.width === preset.width && val?.height === preset.height;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  <span className="text-xs font-semibold">{preset.label}</span>
                  <span className="text-[10px] font-mono opacity-75 mt-0.5">{preset.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      );

    case 'slider':
      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200 block">
                {ctrl.label}
              </label>
              <span className="text-[10px] font-mono text-zinc-500">
                Node {ctrl.target_node} → {ctrl.target_field}
              </span>
            </div>
            <input
              type="number"
              min={ctrl.min}
              max={ctrl.max}
              step={ctrl.step}
              value={val}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-right text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <input
            type="range"
            min={ctrl.min}
            max={ctrl.max}
            step={ctrl.step}
            value={val}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-emerald-500 h-2 bg-zinc-950 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-1">
            <span>{ctrl.min}</span>
            <span>Default: {ctrl.default}</span>
            <span>{ctrl.max}</span>
          </div>
        </div>
      );

    case 'number':
      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200 block">
              {ctrl.label}
            </label>
            <span className="text-[10px] font-mono text-zinc-500">
              Node {ctrl.target_node} → {ctrl.target_field}
            </span>
          </div>
          <input
            type="number"
            min={ctrl.min}
            max={ctrl.max}
            step={ctrl.step || 1}
            value={val}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-right text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
          />
        </div>
      );

    case 'seed':
      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              {ctrl.label}
            </label>
            <button
              type="button"
              onClick={onToggleSeedRandom}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                isSeedRandom
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-300'
              }`}
            >
              {isSeedRandom ? (
                <>
                  <Dices className="w-3.5 h-3.5" /> Randomize
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> Locked
                </>
              )}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={val}
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={onRollRandomSeed}
              className="px-3 py-2 bg-zinc-800 active:bg-zinc-700 text-zinc-200 rounded-xl border border-zinc-700 flex items-center"
            >
              <Dices className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      );

    case 'image_upload':
    case 'video_upload':
    case 'audio_upload':
    case 'media_upload': {
      const acceptMap = {
        image_upload: 'image/*',
        video_upload: 'video/*,image/*',
        audio_upload: 'audio/*',
        media_upload: 'image/*,video/*,audio/*'
      };
      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              {ctrl.label}
            </label>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              Node {ctrl.target_node}
            </span>
          </div>

          {uploadedPreviewUrl && ctrl.component === 'image_upload' && (
            <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 max-h-44 flex items-center justify-center">
              <img
                src={uploadedPreviewUrl}
                alt="Uploaded input"
                className="max-h-44 w-auto object-contain"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="flex-1 cursor-pointer py-2.5 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 text-xs font-semibold text-center active:bg-emerald-500/25 transition-colors">
              {isUploadingImage ? 'Uploading to ComfyUI...' : 'Choose File from Device'}
              <input
                type="file"
                accept={ctrl.accept || acceptMap[ctrl.component] || 'image/*'}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onUploadImage) onUploadImage(ctrl.id, file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div className="text-[10px] font-mono text-zinc-400 truncate">
            Input file: <span className="text-zinc-200">{val}</span>
          </div>
        </div>
      );
    }

    case 'toggle':
      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5 flex items-center justify-between">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200 block">
              {ctrl.label}
            </label>
            <span className="text-[10px] font-mono text-zinc-500">
              Node {ctrl.target_node} → {ctrl.target_field}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(!val)}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors ${
              val ? 'bg-emerald-500' : 'bg-zinc-800 border border-zinc-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                val ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      );

    case 'model_dropdown':
    case 'dropdown': {
      const cacheKey = `${ctrl.object_info_class}.${ctrl.object_info_param}`;
      const dynamicList =
        (ctrl.object_info_class && (availableModels[cacheKey] || availableModels[ctrl.object_info_class])) ||
        ctrl.options ||
        [ctrl.default];

      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              {ctrl.label}
            </label>
            <span className="text-[10px] font-mono text-zinc-500">Node {ctrl.target_node}</span>
          </div>
          <select
            value={val}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
          >
            {dynamicList.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    default:
      return (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              {ctrl.label}
            </label>
            <span className="text-[10px] font-mono text-zinc-500">Node {ctrl.target_node}</span>
          </div>
          <input
            type="text"
            value={val || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500 select-text"
          />
        </div>
      );
  }
}

export default ManifestControlField;