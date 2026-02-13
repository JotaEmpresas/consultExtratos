import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda de "1.553,65" para um número
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(cleanedValue) || 0;
};

// Helper para formatar data de "DD-MM-YYYY" para "DD/MM/YYYY"
const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [day, month, year] = parts;
    return `${day}/${month}/${year}`;
}

export const parseMercadoPago = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const lines = fileContent.split('\n');
    const headerRowIndex = lines.findIndex(line => 
      line.startsWith('RELEASE_DATE;TRANSACTION_TYPE;')
    );

    if (headerRowIndex === -1) {
      return reject(new Error('Cabeçalho do CSV do Mercado Pago não encontrado. Verifique o arquivo.'));
    }

    const csvContent = lines.slice(headerRowIndex).join('\n');

    Papa.parse(csvContent, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const amount = parseCurrency(row['TRANSACTION_NET_AMOUNT']);

          // Estamos interessados apenas nas entradas (valores positivos)
          if (amount > 0) {
            const description = row['TRANSACTION_TYPE']?.trim() || 'Descrição não informada';

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
              id: row['REFERENCE_ID']?.trim() || `mp-${Date.now()}-${index}`,
              date: formatDate(row['RELEASE_DATE']?.trim()),
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
        reject(new Error(`Erro ao processar o CSV do Mercado Pago: ${error.message}`));
      },
    });
  });
};