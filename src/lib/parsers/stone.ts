import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper to parse currency like "28,91"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/"/g, '').trim().replace(',', '.');
  return parseFloat(cleanedValue) || 0;
};

// Helper to extract date from "31/01/2026 23:22"
const parseDate = (value: string | undefined): string => {
    if (!value) return '';
    return value.split(' ')[0];
}

export const parseStone = (fileContent: string): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const movimentacao = row['Movimentação']?.trim();
          const amount = parseCurrency(row['Valor']);

          if (movimentacao === 'Crédito' && amount > 0) {
            const description = `${row['Tipo']?.trim()}: ${row['Origem']?.trim() || 'Origem não informada'}`;
            
            const transaction: Transaction = {
              id: `stone-${Date.now()}-${index}`,
              date: parseDate(row['Data']?.trim()),
              description: description,
              amount: amount,
              category: 'taxable', // Default category
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