import { useState, useEffect } from 'react';
import { X, Search, Image as ImageIcon } from 'lucide-react';
import { fetchApi, API_BASE } from '../../lib/api';

interface GalleryLogo {
  filename: string;
  path: string;
  team_number: string | null;
  team_name: string;
}

interface LogoGalleryModalProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function LogoGalleryModal({ onSelect, onClose }: LogoGalleryModalProps) {
  const [logos, setLogos] = useState<GalleryLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchApi<GalleryLogo[]>('/team-logos-gallery.php')
      .then(setLogos)
      .catch(() => setLogos([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logos.filter(logo => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      logo.team_name.toLowerCase().includes(s) ||
      (logo.team_number && logo.team_number.includes(s))
    );
  });

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white">Galeria de Logos</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por equipe ou número..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Carregando logos...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">
                {search ? 'Nenhum logo encontrado.' : 'Nenhum logo disponível.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map(logo => (
                <button
                  key={logo.filename}
                  onClick={() => {
                    onSelect(logo.path);
                    onClose();
                  }}
                  className="group relative bg-slate-700/50 border border-slate-600 hover:border-orange-500 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-lg hover:shadow-orange-500/20"
                  title={`${logo.team_number ? `#${logo.team_number} - ` : ''}${logo.team_name}`}
                >
                  <div className="aspect-square bg-slate-800 rounded-md overflow-hidden mb-2">
                    <img
                      src={`${API_BASE}/${logo.path}`}
                      alt={logo.team_name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="text-center">
                    {logo.team_number && (
                      <p className="text-xs font-bold text-orange-400 mb-0.5">#{logo.team_number}</p>
                    )}
                    <p className="text-xs text-slate-300 truncate">{logo.team_name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
