import Papa from 'papaparse';
import { Transaction } from '@/types';

// Helper para converter moeda brasileira (ex: "1.234,56") para número
const parseBrazilianCurrency = (value: string): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  return parseFloat(cleanedValue) || 0;
};

// Parser para o formato Cora
const parseCora = (data: any[], fileName: string): Transaction[] => {
  return data
    .filter(row => row['Tipo'] === 'CRÉDITO' && row['Valor (R$)'])
    .map((row, index) => ({
      id: `${fileName}-cora-${index}`,
      date: row['Data'],
      description: row['Histórico'],
      amount: parseBrazilianCurrency(row['Valor (R$)']),
      sourceFile: fileName,
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
    }));
};


const detectAndParse = (data: any[], fileName: string): Transaction[] => {
  const headers = Object.keys(data[0] || {});
  
  // Detecção do Cora
  if (headers.includes('Data') && headers.includes('Histórico') && headers.includes('Valor (R$)') && headers.includes('Tipo')) {
    return parseCora(data, fileName);
  }

  // Detecção do Banco Tradicional
  if (headers.includes('Data') && headers.includes('Histórico') && headers.includes('Valor') && headers.includes('Sinal')) {
    return parseBancoTradicional(data, fileName);
  }

  // Detecção do PagBank
  if (headers.includes('Data da transação') && headers.includes('Descrição') && headers.includes('Valor bruto')) {
    return parsePagBank(data, fileName);
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