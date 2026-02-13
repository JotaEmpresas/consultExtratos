import { Transaction } from '@/types';

// Helper para converter moeda no formato "1.234,56" ou "-50,00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // Remove separadores de milhar '.' e troca a vírgula decimal por ponto '.'
  const cleanedValue = value.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanedValue) || 0;
};

export const parseSicredi = (fileContent: string): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const transactions: Transaction[] = [];
    const lines = fileContent.split('\n');
    
    // Regex para identificar uma linha de transação e capturar suas partes principais
    // Grupo 1: Data (DD/MM/YYYY)
    // Grupo 2: Descrição (todo o texto entre a data e o valor)
    // Grupo 3: Valor (ex: 350,00 ou -1.330,73)
    const transactionRegex = /^(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s+([\-]?\d{1,3}(?:\.\d{3})*,\d{2})\s+[\-]?\d{1,3}(?:\.\d{3})*,\d{2}\s*$/;

    let dataStarted = false;
    for (const line of lines) {
      // Limpa a linha de caracteres indesejados como aspas e quebras de página
      const cleanedLine = line.replace(/"/g, '').replace(/\f/g, '').trim();

      // A leitura dos dados começa após encontrar a linha de cabeçalho
      if (cleanedLine.startsWith('Data') && cleanedLine.includes('Descrição')) {
        dataStarted = true;
        continue;
      }

      if (!dataStarted || cleanedLine.length === 0 || cleanedLine.startsWith('SALDO ANTERIOR')) {
        continue;
      }

      const match = cleanedLine.match(transactionRegex);
      
      if (match) {
        const [, date, description, valueStr] = match;
        const amount = parseCurrency(valueStr);

        // Consideramos apenas as entradas (valores positivos)
        if (amount > 0) {
          const transaction: Transaction = {
            id: `sicredi-${Date.now()}-${Math.random()}`,
            date: date.trim(),
            description: description.trim(),
            amount: amount,
            category: 'taxable', // Categoria padrão
          };
          transactions.push(transaction);
        }
      }
    }

    if (transactions.length === 0 && lines.length > 10) {
        return reject(new Error('Nenhuma transação de crédito válida foi encontrada no arquivo do Sicredi. Verifique o formato do arquivo.'));
    }

    resolve(transactions);
  });
};