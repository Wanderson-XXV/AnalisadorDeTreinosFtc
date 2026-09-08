import { useContext } from 'react';
import { ChampionshipContext } from './championshipContext';

export function useChampionshipContext() {
  const context = useContext(ChampionshipContext);
  if (!context) throw new Error('useChampionshipContext must be used within ChampionshipProvider');
  return context;
}
