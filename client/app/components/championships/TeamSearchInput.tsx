import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import type { Team } from '../../lib/types';
import { fetchApi, resolveLogoUrl } from '../../lib/api';

interface TeamSearchInputProps {
  value: { number: string; name: string };
  onChange: (number: string, name: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function TeamSearchInput({ value, onChange, placeholder, required }: TeamSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Team[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (value.number && value.name) {
      setQuery(`#${value.number} ${value.name}`);
      setSelected(true);
    } else if (value.number) {
      setQuery(`#${value.number}`);
      setSelected(true);
    } else {
      setQuery('');
      setSelected(false);
    }
  }, [value.number, value.name]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchApi<Team[]>(`/teams.php?search=${encodeURIComponent(q)}`);
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleInputChange = (text: string) => {
    setQuery(text);
    setSelected(false);
    onChange('', '');
    doSearch(text);
  };

  const handleSelect = (team: Team) => {
    onChange(String(team.team_number), team.team_name);
    setQuery(`#${team.team_number} ${team.team_name}`);
    setSelected(true);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setSelected(false);
    onChange('', '');
    setResults([]);
    setOpen(false);
  };

  const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-8 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-orange-500';

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      <input
        className={inputCls}
        value={query}
        onChange={e => handleInputChange(e.target.value)}
        onFocus={() => { if (results.length > 0 && !selected) setOpen(true); }}
        placeholder={placeholder ?? 'Buscar equipe...'}
        required={required && !selected}
      />
      {selected && (
        <button type="button" onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {loading && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">...</div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {results.map(team => (
            <button
              key={team.id}
              type="button"
              onClick={() => handleSelect(team)}
              className="w-full text-left px-3 py-2 hover:bg-slate-600 transition-colors flex items-center gap-2"
            >
              {team.logo_url && (
                <img src={resolveLogoUrl(team.logo_url)} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
              )}
              <span className="text-orange-400 font-bold text-sm">#{team.team_number}</span>
              <span className="text-white text-sm truncate">{team.team_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}