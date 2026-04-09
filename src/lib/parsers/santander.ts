import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper para converter moeda no formato "R$ 1,345.37"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // Remove "R$", espaços, e o separador de milhar (,)
  const cleanedValue = value.replace(/R\$\s?/, '').replace(/,/g, '').trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseSantander = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const lines = fileContent.split('\n');
    const headerRowIndex = lines.findIndex(line => 
      line.includes('"Data,""Histórico"')
    );

    if (headerRowIndex === -1) {
      return reject(new Error('Cabeçalho do CSV do Santander não encontrado. Verifique o arquivo.'));
    }

    // Limpa as linhas para que fiquem em um formato CSV válido que o PapaParse entenda
    const cleanedLines = lines.slice(headerRowIndex).map(line => {
        let cleaned = line.trim();
        // 1. Remove as aspas que envolvem a linha inteira
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
        }
        // 2. Substitui as aspas duplas ("") que o banco usa para delimitar campos por aspas simples (")
        cleaned = cleaned.replace(/""/g, '"');
        return cleaned;
    });

    const csvContent = cleanedLines.join('\n');

    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const amount = parseCurrency(row['Valor (R$)']);

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amount > 0) {
            const description = row['Histórico']?.trim() || 'Descrição não informada';

            const category = categorizeTransaction(
              description,
              companyCnpj,
              cpfList,
              nameList,
              amount
            );

            const transaction: Transaction = {
              id: `santander-${Date.now()}-${index}`,
              date: row['Data']?.trim() || '',
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
        reject(new Error(`Erro ao processar o CSV do Santander: ${error.message}`));
      },
    });
  });
};