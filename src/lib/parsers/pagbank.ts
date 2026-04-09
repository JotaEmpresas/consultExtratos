import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter moeda no formato "1,98"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value.trim().replace(',', '.');
  return parseFloat(cleanedValue) || 0;
};

export const parsePagBank = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any) => {
          const amount = parseCurrency(row['VALOR']);

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amount > 0) {
            const description = `${row['TIPO']?.trim()}: ${row['DESCRICAO']?.trim()}` || 'Descrição não informada';

            const category = categorizeTransaction(
              description,
              companyCnpj,
              cpfList,
              nameList,
              amount
            );

            const transaction: Transaction = {
              id: row['CODIGO DA TRANSACAO']?.trim() || `pagbank-${Date.now()}-${Math.random()}`,
              date: row['DATA']?.trim() || '',
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
        reject(new Error(`Erro ao processar o CSV do PagBank: ${error.message}`));
      },
    });
  });
};