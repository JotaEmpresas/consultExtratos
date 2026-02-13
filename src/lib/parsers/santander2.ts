import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "1.234,56" ou "-50,00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  // Remove separadores de milhar '.' e troca a vírgula decimal por ponto '.'
  const cleanedValue = value.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanedValue) || 0;
};

export const parseSantander2 = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    // Encontra o início dos dados reais do CSV
    const lines = fileContent.split('\n');
    const headerRowIndex = lines.findIndex(line => 
      line.includes('Data;') && line.includes('Hist') && line.includes('Valor (R$)')
    );

    if (headerRowIndex === -1) {
      return reject(new Error('Cabeçalho do CSV do Santander (Formato 2) não encontrado. Verifique o arquivo.'));
    }

    const csvContent = lines.slice(headerRowIndex).join('\n');

    Papa.parse(csvContent, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          // O cabeçalho pode ter caracteres com codificação errada, então buscamos a chave de forma flexível
          const valorKey = Object.keys(row).find(k => k.includes('Valor (R$)')) || '';
          const amount = parseCurrency(row[valorKey]);

          // Estamos interessados apenas em entradas de crédito (valores positivos)
          if (amount > 0) {
            const historicoKey = Object.keys(row).find(k => k.includes('Hist')) || '';
            const description = row[historicoKey]?.trim() || 'Descrição não informada';

            const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

            const cleanedCnpj = companyCnpj.replace(/\D/g, '');
            const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
            const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

            const isOwnAccount = 
              (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
              cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
              cleanedNameList.some(name => name && normalizedDesc.includes(name));

            const dataKey = Object.keys(row).find(k => k.toLowerCase().includes('data')) || '';
            const transaction: Transaction = {
              id: `santander2-${Date.now()}-${index}`,
              date: row[dataKey]?.trim() || '',
              description: description,
              amount: amount,
              category: isOwnAccount ? 'non-taxable' : 'taxable',
            };
            
            if (transaction.date && transaction.description) {
              transactions.push(transaction);
            }
          }
        });
        
        if (transactions.length === 0 && results.data.length > 1) {
            return reject(new Error('Nenhuma transação de crédito válida foi encontrada no arquivo do Santander (Formato 2).'));
        }
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Santander (Formato 2): ${error.message}`));
      },
    });
  });
};