import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter moeda no formato "+R$ 1,000.00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value
    .replace(/[+R$\s"]/g, '') // remove +, R$, espaços e aspas
    .replace(/,/g, '')         // remove separadores de milhar
    .trim();
  return parseFloat(cleanedValue) || 0;
};

// Helper para formatar data de YYYY-MM-DD para DD/MM/YYYY
const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
}

export const parseInfinitPay = (
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
        
        results.data.forEach((row: any, index: number) => {
          const amountStr = row['Amount']?.trim();

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amountStr && amountStr.startsWith('+')) {
            const amount = parseCurrency(amountStr);

            if (amount > 0) {
              const description = `${row['Transaction Type']?.trim()}: ${row['Name']?.trim()}` || 'Descrição não informada';

              const category = categorizeTransaction(
                description,
                companyCnpj,
                cpfList,
                nameList,
                amount
              );

              const transaction: Transaction = {
                id: `infinitpay-${Date.now()}-${index}`,
                date: formatDate(row['Date']?.trim()),
                description: description,
                amount: amount,
                category,
              };
              
              if (transaction.date && transaction.description) {
                transactions.push(transaction);
              }
            }
          }
        });
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV da InfinitPay: ${error.message}`));
      },
    });
  });
};