import { Transaction } from '@/types';
import { parseBancoDaAmazonia } from './parsers/bancoDaAmazonia';
import { parseStone } from './parsers/stone';
import { parseNubank } from './parsers/nubank';

export const bankOptions = [
  { value: 'banco-da-amazonia', label: 'Banco da Amazônia' },
  { value: 'stone', label: 'Stone' },
  { value: 'nubank', label: 'Nubank' },
  // Futuros bancos serão adicionados aqui
];

export const parsers: { [key: string]: (fileContent: string) => Promise<Transaction[]> } = {
  'banco-da-amazonia': parseBancoDaAmazonia,
  'stone': parseStone,
  'nubank': parseNubank,
};