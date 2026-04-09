import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value
    .replace(/['"R$\s]/g, '')
    .replace(/-/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(cleanedValue) || 0;
};

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  return dateStr.trim().substring(0, 10);
};

export const parseInfinitPay4 = (
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
        const firstRow = results.data[0] as any;
        if (!firstRow || !('Data e hora' in firstRow) || !('Líquido (R$)' in firstRow) || !('Status' in firstRow)) {
          return reject(new Error('Cabeçalho do CSV do InfinitPay (Formato 4) não encontrado. Verifique o arquivo.'));
        }

        const transactions: Transaction[] = [];

        results.data.forEach((row: any, index: number) => {
          if (row['Status']?.trim() !== 'Aprovada') return;

          const amount = parseCurrency(row['Líquido (R$)']);
          if (amount <= 0) return;

          const meio = row['Meio - Meio']?.trim() || '';
          const bandeira = row['Meio - Bandeira']?.trim() || '';
          const origem = row['Origem - Nome']?.trim() || '';

          let description = meio;
          if (bandeira && bandeira.toLowerCase() !== 'pix' && bandeira.toLowerCase() !== 'money') {
            description += ` ${bandeira}`;
          }
          if (origem) description += `: ${origem}`;
          if (!description) description = 'Descrição não informada';

          const category = categorizeTransaction(
            description,
            companyCnpj,
            cpfList,
            nameList,
            amount
          );

          const transaction: Transaction = {
            id: `infinitpay4-${Date.now()}-${index}`,
            date: formatDate(row['Data e hora']),
            description,
            amount,
            category,
          };

          if (transaction.date) {
            transactions.push(transaction);
          }
        });

        if (transactions.length === 0 && results.data.length > 1) {
          return reject(new Error('Nenhuma transação aprovada foi encontrada no arquivo do InfinitPay (Formato 4). Verifique o arquivo.'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do InfinitPay (Formato 4): ${error.message}`));
      },
    });
  });
};
