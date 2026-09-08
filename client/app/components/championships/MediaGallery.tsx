import { useState } from 'react';
import { X, Play, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MatchMedia, MediaCategory } from '../../lib/types';
import { resolveMediaUrl } from '../../lib/api';

interface MediaGalleryProps {
  media: MatchMedia[];
  onDelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
}

const tabs: { value: MediaCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'key_moment', label: 'Momentos-chave' },
  { value: 'other', label: 'Outros' },
];

function isYoutube(path: string) {
  return path.includes('youtube.com') || path.includes('youtu.be');
}

function getYoutubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : '';
}

function MediaThumb({ item, onClick }: { item: MatchMedia; onClick: () => void }) {
  const src = resolveMediaUrl(item.file_path);
  const isYt = isYoutube(item.file_path);
  const thumbSrc = item.thumbnail_url || (item.thumbnail_path ? resolveMediaUrl(item.thumbnail_path) : isYt
    ? `https://img.youtube.com/vi/${getYoutubeId(item.file_path)}/mqdefault.jpg`
    : src);

  return (
    <button
      onClick={onClick}
      className="relative group aspect-video bg-slate-700 rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-500 transition-all"
    >
      {item.file_type === 'image' ? (
        <img src={src} alt={item.title ?? item.original_filename} className="w-full h-full object-cover" />
      ) : (
        <>
          {isYt ? (
            <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <video src={src} className="w-full h-full object-cover" preload="metadata" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
            <Play className="w-8 h-8 text-white drop-shadow" />
          </div>
        </>
      )}
      {item.title && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-xs text-white truncate">
          {item.title}
        </div>
      )}
    </button>
  );
}

function Lightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
  onDelete,
  canDelete,
}: {
  items: MatchMedia[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
}) {
  const item = items[index];
  const src = resolveMediaUrl(item.file_path);
  const isYt = isYoutube(item.file_path);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(item.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[70] flex flex-col"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <span className="text-sm text-slate-400">{item.title ?? item.original_filename}</span>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-slate-400 hover:text-red-400 transition-colors p-1"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative min-h-0 px-12">
        {items.length > 1 && (
          <button
            onClick={onPrev}
            className="absolute left-2 p-2 text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className="max-w-4xl w-full max-h-full flex items-center justify-center">
          {item.file_type === 'image' ? (
            <img src={src} alt={item.title ?? ''} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
          ) : isYt ? (
            <iframe
              src={`https://www.youtube.com/embed/${getYoutubeId(item.file_path)}?autoplay=1`}
              className="w-full aspect-video rounded-lg"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <video
              src={src}
              controls
              autoPlay
              className="max-w-full max-h-[75vh] rounded-lg"
            />
          )}
        </div>

        {items.length > 1 && (
          <button
            onClick={onNext}
            className="absolute right-2 p-2 text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="text-center py-2 text-xs text-slate-500 flex-shrink-0">
        {index + 1} / {items.length}
      </div>
    </div>
  );
}

export function MediaGallery({ media, onDelete, canDelete }: MediaGalleryProps) {
  const [activeTab, setActiveTab] = useState<MediaCategory | 'all'>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filtered = activeTab === 'all' ? media : media.filter(m => m.category === activeTab);

  if (media.length === 0) return null;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeTab === t.value
                ? 'bg-orange-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.value !== 'all' && (
              <span className="ml-1 opacity-70">
                ({media.filter(m => m.category === t.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">Nenhuma mídia nesta categoria.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((item, i) => (
            <MediaThumb key={item.id} item={item} onClick={() => setLightboxIndex(i)} />
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={filtered}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => (i !== null && i > 0 ? i - 1 : filtered.length - 1))}
          onNext={() => setLightboxIndex(i => (i !== null ? (i + 1) % filtered.length : 0))}
          onDelete={onDelete}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}
