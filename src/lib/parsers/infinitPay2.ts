import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter moeda no formato "1.234,56"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value
    .replace(/\./g, '')      // remove separadores de milhar
    .replace(',', '.')      // troca a vírgula decimal por ponto
    .trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseInfinitPay2 = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const lines = fileContent.split('\n');
    const headerRowIndex = lines.findIndex(line => 
      line.startsWith('Data Lançamento;Histórico;Descrição;Valor;Saldo')
    );

    if (headerRowIndex === -1) {
      return reject(new Error('Cabeçalho do CSV do InfinitPay (Formato 2) não encontrado. Verifique o arquivo.'));
    }

    const csvContent = lines.slice(headerRowIndex).join('\n');

    Papa.parse(csvContent, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const amount = parseCurrency(row['Valor']);

          // Processar apenas transações de crédito (valores positivos)
          if (amount > 0) {
            const historico = row['Histórico']?.trim() || '';
            const descricao = row['Descrição']?.trim() || '';
            const description = `${historico} - ${descricao}`;
            
            const category = categorizeTransaction(
              description,
              companyCnpj,
              cpfList,
              nameList,
              amount
            );

            const transaction: Transaction = {
              id: `infinitpay2-${Date.now()}-${index}`,
              date: row['Data Lançamento']?.trim() || '',
              description: description || 'Descrição não informada',
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
        reject(new Error(`Erro ao processar o CSV do InfinitPay (Formato 2): ${error.message}`));
      },
    });
  });
};