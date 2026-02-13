import { Transaction } from '@/types';
import { parseBancoDaAmazonia } from './parsers/bancoDaAmazonia';

export const bankOptions = [
  { value: 'banco-da-amazonia', label: 'Banco da Amazônia' },
  // Futuros bancos serão adicionados aqui
];

export const parsers: { [key: string]: (fileContent: string) => Promise<Transaction[]> } = {
  'banco-da-amazonia': parseBancoDaAmazonia,
};