import Papa from 'papaparse';
import { Transaction } from '@/types';

// Helper para converter moeda brasileira (ex: "1.234,56") para número
const parseBrazilianCurrency = (value: string): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  return parseFloat(cleanedValue) || 0;
};

// Parser para o formato Cora (original)
const parseCora = (data: any[], fileName: string): Transaction[] => {
  return data
    .filter(row => row['Tipo'] === 'CRÉDITO' && row['Valor (R$)'])
    .map((row, index) => ({
      id: `${fileName}-cora-${index}`,
      date: row['Data'],
      description: row['Histórico'],
      amount: parseBrazilianCurrency(row['Valor (R$)']),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

// Parser para o formato "Banco Tradicional" (ex: Banco do Brasil)
const parseBancoTradicional = (data: any[], fileName:string): Transaction[] => {
    return data
      .filter(row => row['Sinal'] === 'C' && row['Valor'])
      .map((row, index) => ({
        id: `${fileName}-bb-${index}`,
        date: row['Data'],
        description: row['Histórico'],
        amount: parseBrazilianCurrency(row['Valor']),
        sourceFile: fileName,
        category: 'taxable',
      }));
}

// Parser para o formato PagBank
const parsePagBank = (data: any[], fileName: string): Transaction[] => {
  return data
    .filter(row => row['Valor bruto'] && parseBrazilianCurrency(row['Valor bruto']) > 0)
    .map((row, index) => ({
      id: `${fileName}-pagbank-${index}`,
      date: row['Data da transação'],
      description: row['Descrição'],
      amount: parseBrazilianCurrency(row['Valor bruto']),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

// Parser para o formato Inter (cora_01_a31_Janeiro.csv)
const parseInter = (data: any[], fileName: string): Transaction[] => {
  return data
    .filter(row => row['Tipo Transação'] === 'CRÉDITO' && row['Valor'])
    .map((row, index) => ({
      id: `${fileName}-inter-${index}`,
      date: row['Data'],
      description: row['Identificação'] || row['Transação'],
      amount: parseBrazilianCurrency(row['Valor']),
      sourceFile: fileName,
      category: 'taxable',
    }));
};

// Parser para o formato PagSeguro (2026-01-01_2026-01-31W.csv)
const parsePagSeguro = (data: any[], fileName: string): Transaction[] => {
    return data
      .filter(row => row['VALOR'] && parseBrazilianCurrency(row['VALOR']) > 0)
      .map((row, index) => ({
        id: `${fileName}-pagseguro-${index}`,
        date: row['DATA'],
        description: row['DESCRICAO'] || row['TIPO'],
        amount: parseBrazilianCurrency(row['VALOR']),
        sourceFile: fileName,
        category: 'taxable',
      }));
};

// Helper to check for headers case-insensitively
const hasHeaders = (actualHeaders: string[], requiredHeaders: string[]): boolean => {
  const lowercasedActual = actualHeaders.map(h => h.toLowerCase());
  return requiredHeaders.every(rh => lowercasedActual.includes(rh.toLowerCase()));
};

const detectAndParse = (data: any[], fileName: string): Transaction[] => {
  if (!data || data.length === 0) {
    return [];
  }
  const headers = Object.keys(data[0] || {});
  
  // Detecção do Cora (original)
  if (hasHeaders(headers, ['Data', 'Histórico', 'Valor (R$)', 'Tipo'])) {
    return parseCora(data, fileName);
  }

  // Detecção do Banco Tradicional
  if (hasHeaders(headers, ['Data', 'Histórico', 'Valor', 'Sinal'])) {
    return parseBancoTradicional(data, fileName);
  }

  // Detecção do PagBank
  if (hasHeaders(headers, ['Data da transação', 'Descrição', 'Valor bruto'])) {
    return parsePagBank(data, fileName);
  }

  // Detecção do Inter (cora_01_a31_Janeiro.csv)
  if (hasHeaders(headers, ['Data', 'Transação', 'Tipo Transação', 'Valor'])) {
    return parseInter(data, fileName);
  }

  // Detecção do PagSeguro (2026-01-01_2026-01-31W.csv)
  if (hasHeaders(headers, ['DATA', 'TIPO', 'DESCRICAO', 'VALOR'])) {
    return parsePagSeguro(data, fileName);
  }

  console.warn(`Formato de arquivo não reconhecido para: ${fileName}`);
  return [];
};

export const parseCsvFiles = (files: File[]): Promise<Transaction[]> => {
  const promises = files.map(file => {
    return new Promise<Transaction[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transactions = detectAndParse(results.data, file.name);
            resolve(transactions);
          } catch (error) {
            console.error(`Erro ao processar o arquivo ${file.name}:`, error);
            reject(error);
          }
        },
        error: (error) => {
          console.error(`Erro ao ler o arquivo ${file.name}:`, error);
          reject(error);
        },
      });
    });
  });

  return Promise.all(promises).then(results => results.flat());
};