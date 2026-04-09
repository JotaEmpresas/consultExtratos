import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter moeda no formato "+R$ 23,05"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value
    .replace(/[+R$\s"]/g, '') // remove +, R$, espaços e aspas
    .replace(/\./g, '')       // remove separadores de milhar
    .replace(',', '.')       // troca a vírgula decimal por ponto
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

export const parseInfinitPay3 = (
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
            console.error("Erros no parse do InfinitPay (Formato 3):", results.errors);
        }
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const valorStr = row['Valor']?.trim();

          // Processar todas as transações (créditos e débitos)
          if (valorStr) {
            const amount = parseCurrency(valorStr);
            const tipo = row['Tipo de transação']?.trim() || '';
            const nome = row['Nome']?.trim() || '';
            const detalhe = row['Detalhe']?.trim() || '';
            
            let description = tipo;
              if (nome) description += `: ${nome}`;
              if (detalhe) description += ` (${detalhe})`;
              if (!description) description = 'Descrição não informada';

              const category = categorizeTransaction(
                description,
                companyCnpj,
                cpfList,
                nameList,
                amount
              );

              const transaction: Transaction = {
                id: `infinitpay3-${Date.now()}-${index}`,
                date: formatDate(row['Data']?.trim()),
                description: description,
                amount: amount,
                category,
              };
              
              if (transaction.date) {
                transactions.push(transaction);
              }
          }
        });
        
        if (transactions.length === 0 && results.data.length > 1) {
            return reject(new Error('Nenhuma transação de crédito válida foi encontrada no arquivo do InfinitPay (Formato 3). Verifique o formato do arquivo.'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do InfinitPay (Formato 3): ${error.message}`));
      },
    });
  });
};