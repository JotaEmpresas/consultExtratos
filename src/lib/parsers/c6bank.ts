import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper to parse currency like "6170.00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // C6 uses '.' as a decimal separator, so it's a standard float.
  return parseFloat(value) || 0;
};

export const parseC6Bank = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const lines = fileContent.split('\n');
    const headerRowIndex = lines.findIndex(line => 
      line.startsWith('Data Lançamento,Data Contábil,Título,')
    );

    if (headerRowIndex === -1) {
      return reject(new Error('Cabeçalho do CSV do C6 Bank não encontrado. Verifique o arquivo.'));
    }

    const csvContent = lines.slice(headerRowIndex).join('\n');

    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const amount = parseCurrency(row['Entrada(R$)']);

          // We are only interested in credit entries
          if (amount > 0) {
            const description = row['Título']?.trim() || 'Descrição não informada';

            const category = categorizeTransaction(
              description,
              companyCnpj,
              cpfList,
              nameList,
              amount
            );

            const transaction: Transaction = {
              id: `c6-${Date.now()}-${index}`,
              date: row['Data Lançamento']?.trim() || '',
              description: description,
              amount: amount,
              category,
            };
            
            if (transaction.date) {
              transactions.push(transaction);
            }
          }
        });
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do C6 Bank: ${error.message}`));
      },
    });
  });
};