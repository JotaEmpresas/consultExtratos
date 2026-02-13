import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter o formato de moeda do Nubank (ex: "75.00")
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // O CSV do Nubank usa '.' como separador decimal.
  return parseFloat(value) || 0;
};

export const parseNubank = (fileContent: string): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any) => {
          const amount = parseCurrency(row['Valor']);

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amount > 0) {
            const transaction: Transaction = {
              id: row['Identificador']?.trim() || `nubank-${Date.now()}-${Math.random()}`,
              date: row['Data']?.trim() || '',
              description: row['Descrição']?.trim() || 'Descrição não informada',
              amount: amount,
              category: 'taxable', // Categoria padrão
            };
            
            // Validação básica
            if (transaction.date && transaction.description) {
              transactions.push(transaction);
            }
          }
        });
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Nubank: ${error.message}`));
      },
    });
  });
};