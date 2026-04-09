import { Transaction } from '@/types';
import Papa from 'papaparse';
import { categorizeTransaction, extractNumbers, normalizeText } from '../utils';

// Helper to clean and parse the specific currency format from the bank
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // Removes quotes, spaces, thousand separators '.', and replaces decimal ',' with '.'
  const cleanedValue = value.replace(/"/g, '').trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanedValue) || 0;
};

export const parseBancoDaAmazonia = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    // First, find the actual header row, as the file has junk at the top.
    const lines = fileContent.split('\n');
    const headerRowIndex = lines.findIndex(line => 
      line.includes('DATA') && line.includes('DESCRICAO_HISTORICO') && line.includes('VALOR') && line.includes('DC')
    );

    if (headerRowIndex === -1) {
      return reject(new Error('Cabeçalho do CSV do Banco da Amazônia não encontrado. Verifique o arquivo.'));
    }

    // Reconstruct the content starting from the correct header
    const csvContent = lines.slice(headerRowIndex).join('\n');

    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.trim(),
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const dc = row['DC']?.trim();
          const amount = parseCurrency(row['VALOR']);
          const signedAmount = dc === 'D' ? -amount : amount;

          const description = row['DESCRICAO_HISTORICO']?.trim() || 'Descrição não informada';

          const category = categorizeTransaction(
            description,
            companyCnpj,
            cpfList,
            nameList,
            signedAmount
          );

          const transaction: Transaction = {
            id: `bda-${Date.now()}-${index}`,
            date: row['DATA']?.trim() || '',
            description: description,
            amount: signedAmount,
            category,
          };
          
          // Basic validation
          if (transaction.date && transaction.description) {
            transactions.push(transaction);
          }
        });
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Banco da Amazônia: ${error.message}`));
      },
    });
  });
};