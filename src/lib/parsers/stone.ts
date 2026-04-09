import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper to parse currency like "28,91" or "R$ 1.234,56"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // Remove R$, quotes, spaces, and thousands separator (dot), then replace decimal separator (comma) with dot
  const cleanedValue = value
    .replace(/R\$/g, '')
    .replace(/"/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleanedValue) || 0;
};

// Helper to extract date from "31/01/2026 23:22"
const parseDate = (value: string | undefined): string => {
    if (!value) return '';
    return value.split(' ')[0];
}

export const parseStone = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        const headers = results.meta.fields || [];
        
        results.data.forEach((row: any, index: number) => {
          let data = row;
          
          // Check if the row is collapsed into the first header (happens if the whole row is quoted)
          const firstKey = headers[0];
          if (headers.length > 1 && row[firstKey] && row[firstKey].includes(',') && !row[headers[1]]) {
            const line = row[firstKey];
            const subParse = Papa.parse(line, { header: false });
            if (subParse.data && subParse.data.length > 0) {
              const values = subParse.data[0] as string[];
              data = {};
              headers.forEach((h, i) => {
                data[h] = values[i];
              });
            }
          }

          // Normalize keys to handle potential encoding issues or variations
          const getVal = (possibleKeys: string[]) => {
            for (const key of possibleKeys) {
              if (data[key] !== undefined) return data[key];
              // Try normalized version
              const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              for (const actualKey of Object.keys(data)) {
                const normalizedActual = actualKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (normalizedActual === normalizedKey) return data[actualKey];
              }
            }
            return undefined;
          };

          const movimentacao = getVal(['Movimentação', 'Movimentacao'])?.trim();
          const amount = parseCurrency(getVal(['Valor']));
          const tipo = getVal(['Tipo'])?.trim() || '';
          const origem = getVal(['Origem'])?.trim() || 'Origem não informada';
          const dataStr = getVal(['Data'])?.trim() || '';

          if (movimentacao === 'Crédito' && amount > 0) {
            const description = `${tipo}: ${origem}`;
            
            const category = categorizeTransaction(
              description,
              companyCnpj,
              cpfList,
              nameList,
              amount
            );

            const transaction: Transaction = {
              id: `stone-${Date.now()}-${index}`,
              date: parseDate(dataStr),
              description: description,
              amount: amount,
              category,
            };
            
            if (transaction.date && transaction.description) {
              transactions.push(transaction);
            }
          }
        });
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV da Stone: ${error.message}`));
      },
    });
  });
};