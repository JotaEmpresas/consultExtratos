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
import { parseBradesco2 } from './parsers/bradesco2';
import { parseMercadoPago } from './parsers/mercadoPago';
import { parseC6Bank } from './parsers/c6bank';
import { parsePagBank } from './parsers/pagbank';
import { parseCora } from './parsers/cora';

export const bankOptions = [
  { value: 'banco-da-amazonia', label: 'Banco da Amazônia' },
  { value: 'banco-do-brasil', label: 'Banco do Brasil' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'bradesco-2', label: 'Bradesco (Formato 2)' },
  { value: 'c6-bank', label: 'C6 Bank' },
  { value: 'cora', label: 'Cora' },
  { value: 'infinitpay', label: 'InfinitPay' },
  { value: 'itau', label: 'Itaú' },
  { value: 'mercado-pago', label: 'Mercado Pago' },
  { value: 'nubank', label: 'Nubank' },
  { value: 'pagbank', label: 'PagBank' },
  { value: 'santander', label: 'Santander' },
  { value: 'sicredi', label: 'Sicredi' },
  { value: 'stone', label: 'Stone' },
  // Futuros bancos serão adicionados aqui
];

export const parsers: { [key: string]: (fileContent: string, companyCnpj: string, cpfList: string[], nameList: string[]) => Promise<Transaction[]> } = {
  'banco-da-amazonia': parseBancoDaAmazonia,
  'banco-do-brasil': parseBancoDoBrasil,
  'bradesco': parseBradesco,
  'bradesco-2': parseBradesco2,
  'c6-bank': parseC6Bank,
  'cora': parseCora,
  'infinitpay': parseInfinitPay,
  'itau': parseItau,
  'mercado-pago': parseMercadoPago,
  'nubank': parseNubank,
  'pagbank': parsePagBank,
  'santander': parseSantander,
  'sicredi': parseSicredi,
  'stone': parseStone,
};