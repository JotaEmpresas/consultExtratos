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
import { parseMercadoPago } from './parsers/mercadoPago';
import { parseC6Bank } from './parsers/c6bank';
import { parsePagBank } from './parsers/pagbank';
import { parseCora } from './parsers/cora';
import { parseInter } from './parsers/inter';
import { parseSantander2 } from './parsers/santander2';
import { parseSicoob } from './parsers/sicoob';
import { parseInfinitPay2 } from './parsers/infinitPay2';
import { parseInfinitPay3 } from './parsers/infinitPay3';

export const bankOptions = [
  { value: 'banco-da-amazonia', label: 'Banco da Amazônia' },
  { value: 'banco-do-brasil', label: 'Banco do Brasil' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'c6-bank', label: 'C6 Bank' },
  { value: 'cora', label: 'Cora' },
  { value: 'infinitpay', label: 'InfinitPay' },
  { value: 'infinitpay-2', label: 'InfinitPay (Formato 2)' },
  { value: 'infinitpay-3', label: 'InfinitPay (Formato 3)' },
  { value: 'inter', label: 'Inter' },
  { value: 'itau', label: 'Itaú' },
  { value: 'mercado-pago', label: 'Mercado Pago' },
  { value: 'nubank', label: 'Nubank' },
  { value: 'pagbank', label: 'PagBank' },
  { value: 'santander', label: 'Santander' },
  { value: 'santander-2', label: 'Santander (Formato 2)' },
  { value: 'sicredi', label: 'Sicredi' },
  { value: 'sicoob', label: 'Sicoob' },
  { value: 'stone', label: 'Stone' },
  // Futuros bancos serão adicionados aqui
];

export const parsers: { [key: string]: (fileContent: string, companyCnpj: string, cpfList: string[], nameList: string[]) => Promise<Transaction[]> } = {
  'banco-da-amazonia': parseBancoDaAmazonia,
  'banco-do-brasil': parseBancoDoBrasil,
  'bradesco': parseBradesco,
  'c6-bank': parseC6Bank,
  'cora': parseCora,
  'infinitpay': parseInfinitPay,
  'infinitpay-2': parseInfinitPay2,
  'infinitpay-3': parseInfinitPay3,
  'inter': parseInter,
  'itau': parseItau,
  'mercado-pago': parseMercadoPago,
  'nubank': parseNubank,
  'pagbank': parsePagBank,
  'santander': parseSantander,
  'santander-2': parseSantander2,
  'sicredi': parseSicredi,
  'sicoob': parseSicoob,
  'stone': parseStone,
};