import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter o formato de moeda do Nubank (ex: "75.00")
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // O CSV do Nubank usa '.' como separador decimal.
  return parseFloat(value) || 0;
};

export const parseNubank = (
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
        
        results.data.forEach((row: any) => {
          const amount = parseCurrency(row['Valor']);

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amount > 0) {
            const description = row['Descrição']?.trim() || 'Descrição não informada';

            // Exclui linhas de saldo
            if (description.toLowerCase().includes('saldo total disponível') || 
                description.toLowerCase().includes('saldo anterior')) {
              return;
            }

            // Categoriza usando a função centralizada
            const category = categorizeTransaction(
              description,
              companyCnpj,
              cpfList,
              nameList,
              amount
            );

            const transaction: Transaction = {
              id: row['Identificador']?.trim() || `nubank-${Date.now()}-${Math.random()}`,
              date: row['Data']?.trim() || '',
              description: description,
              amount: amount,
              category,
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