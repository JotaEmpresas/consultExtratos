import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "10.000,00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseBradesco = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const lines = fileContent.split('\n');
    
    // Filtra apenas as linhas que são de fato transações (começam com uma data no formato DD/MM/YYYY)
    const transactionLines = lines.filter(line => /^\d{2}\/\d{2}\/\d{4};/.test(line.trim()));

    if (transactionLines.length === 0) {
      return reject(new Error('Nenhuma transação válida foi encontrada no arquivo do Bradesco. Verifique o formato.'));
    }

    // Remonta um CSV limpo apenas com as transações e um cabeçalho padronizado
    const header = "Data;Lancamento;Dcto;Credito;Debito;Saldo\n";
    const csvContent = header + transactionLines.join('\n');

    Papa.parse(csvContent, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const amount = parseCurrency(row['Credito']);

          // Processar apenas transações de crédito (valores positivos)
          if (amount > 0) {
            const description = row['Lancamento']?.trim() || 'Descrição não informada';

            const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

            const cleanedCnpj = companyCnpj.replace(/\D/g, '');
            const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
            const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

            const isOwnAccount = 
              (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
              cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
              cleanedNameList.some(name => name && normalizedDesc.includes(name));

            const transaction: Transaction = {
              id: `bradesco-${Date.now()}-${index}`,
              date: row['Data']?.trim() || '',
              description: description,
              amount: amount,
              category: isOwnAccount ? 'non-taxable' : 'taxable',
            };
            
            if (transaction.date) {
              transactions.push(transaction);
            }
          }
        });
        
        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Bradesco: ${error.message}`));
      },
    });
  });
};