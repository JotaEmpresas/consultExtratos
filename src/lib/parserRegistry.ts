import { Transaction } from '@/types';
import { parseBancoDaAmazonia } from './parsers/bancoDaAmazonia';
import { parseStone } from './parsers/stone';
import { parseNubank } from './parsers/nubank';
import { parseSicredi } from './parsers/sicredi';
import { parseSantander } from './parsers/santander';
import { parseBancoDoBrasil } from './parsers/bancoDoBrasil';
import { parseInfinitPay } from './parsers/infinitPay';
import { parseItau } from './parsers/itau';
import { parseBradesco } from './parsers/bradesco';

export const bankOptions = [
  { value: 'banco-da-amazonia', label: 'Banco da Amazônia' },
  { value: 'banco-do-brasil', label: 'Banco do Brasil' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'infinitpay', label: 'InfinitPay' },
  { value: 'itau', label: 'Itaú' },
  { value: 'nubank', label: 'Nubank' },
  { value: 'santander', label: 'Santander' },
  { value: 'sicredi', label: 'Sicredi' },
  { value: 'stone', label: 'Stone' },
  // Futuros bancos serão adicionados aqui
];

export const parsers: { [key: string]: (fileContent: string, companyCnpj: string, cpfList: string[], nameList: string[]) => Promise<Transaction[]> } = {
  'banco-da-amazonia': parseBancoDaAmazonia,
  'banco-do-brasil': parseBancoDoBrasil,
  'bradesco': parseBradesco,
  'infinitpay': parseInfinitPay,
  'itau': parseItau,
  'nubank': parseNubank,
  'santander': parseSantander,
  'sicredi': parseSicredi,
  'stone': parseStone,
};