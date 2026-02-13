import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "R$ 1,345.37" ou "-R$ 500.00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // Remove "R$", espaços, e o separador de milhar (,)
  const cleanedValue = value.replace(/R\$\s?/, '').replace(/,/g, '').trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseSantander = (fileContent: string): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    // O arquivo do Santander tem lixo no topo, então encontramos o cabeçalho primeiro.
    const lines = fileContent.split('\n');
    const headerRowIndex = lines.findIndex(line => 
      line.startsWith('"Data,""Histórico"')
    );

    if (headerRowIndex === -1) {
      return reject(new Error('Cabeçalho do CSV do Santander não encontrado. Verifique o arquivo.'));
    }

    // Reconstrói o conteúdo a partir do cabeçalho correto
    const csvContent = lines.slice(headerRowIndex).join('\n');

    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      // O PapaParse lida com as aspas duplas automaticamente
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const amount = parseCurrency(row['Valor (R$)']);

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amount > 0) {
            const transaction: Transaction = {
              id: `santander-${Date.now()}-${index}`,
              date: row['Data']?.trim() || '',
              description: row['Histórico']?.trim() || 'Descrição não informada',
              amount: amount,
              category: 'taxable', // Categoria padrão
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
        reject(new Error(`Erro ao processar o CSV do Santander: ${error.message}`));
      },
    });
  });
};