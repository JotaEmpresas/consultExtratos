import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper to parse currency like "987.82"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // Cora uses '.' as a decimal separator, so it's a standard float.
  return parseFloat(value) || 0;
};

export const parseCora = (
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
        if (results.errors.length > 0) {
            console.error("Erros no parse do Cora:", results.errors);
        }
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const tipo = row['Tipo Transação']?.trim();
          
          if (tipo === 'CRÉDITO') {
            const amount = parseCurrency(row['Valor']);

            if (amount > 0) {
              const transacao = row['Transação']?.trim() || '';
              const identificacao = row['Identificação']?.trim() || '';
              const description = identificacao ? `${transacao} - ${identificacao}` : transacao;
              
              const category = categorizeTransaction(
                description,
                companyCnpj,
                cpfList,
                nameList,
                amount
              );

              const transaction: Transaction = {
                id: `cora-${Date.now()}-${index}`,
                date: row['Data']?.trim() || '',
                description: description || 'Descrição não informada',
                amount: amount,
                category,
              };
              
              if (transaction.date) {
                transactions.push(transaction);
              }
            }
          }
        });
        
        if (transactions.length === 0 && results.data.length > 1) {
            return reject(new Error('Nenhuma transação de crédito válida foi encontrada no arquivo do Cora. Verifique o formato do arquivo.'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Cora: ${error.message}`));
      },
    });
  });
};