import { Transaction } from '@/types';
import Papa from 'papaparse';

// Helper para converter moeda no formato "10.000,00"
const parseCurrency = (value: string | undefined): number => {
  if (!value) return 0;
  const cleanedValue = value.replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(cleanedValue) || 0;
};

export const parseBradesco2 = (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: Transaction[] = [];
        let headerFound = false;
        let dateIndex = -1;
        let descriptionIndex = -1;
        let creditIndex = -1;
        let valueIndex = -1;

        const headerRowIndex = results.data.findIndex((row: any) => {
            if (!Array.isArray(row)) return false;
            const lowerCaseRow = row.map(c => String(c || '').toLowerCase());
            // Procura por 'data' e 'lan' para ser mais robusto a erros de encoding ('lançamento' -> 'lan�amento')
            return lowerCaseRow.some(c => c.includes('data')) && lowerCaseRow.some(c => c.includes('lan'));
        });

        if (headerRowIndex !== -1) {
            const header: string[] = results.data[headerRowIndex].map((h: any) => String(h || '').toLowerCase());
            headerFound = true;
            dateIndex = header.findIndex(h => h.includes('data'));
            descriptionIndex = header.findIndex(h => h.includes('lan')); // 'lan' para 'lançamento'
            creditIndex = header.findIndex(h => h.includes('crédito'));
            
            if (creditIndex === -1) {
                valueIndex = header.findIndex(h => h.includes('valor'));
            }
        } else {
            // Fallback para o formato sem cabeçalho explícito, mas com estrutura fixa
            dateIndex = 0;
            descriptionIndex = 1;
            creditIndex = 3;
        }

        const dataToParse = headerFound ? results.data.slice(headerRowIndex + 1) : results.data;

        dataToParse.forEach((row: any, index: number) => {
          if (!Array.isArray(row) || dateIndex === -1 || descriptionIndex === -1) return;

          const dateStr = row[dateIndex]?.trim();
          if (!dateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            return;
          }

          let amount = 0;
          
          if (valueIndex !== -1) {
            const valueStr = row[valueIndex];
            const parsedValue = parseCurrency(valueStr);
            if (parsedValue > 0) {
                amount = parsedValue;
            }
          } else if (creditIndex !== -1) {
            const creditStr = row[creditIndex];
            amount = parseCurrency(creditStr);
          }

          if (amount > 0) {
            const description = row[descriptionIndex]?.trim() || 'Descrição não informada';

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
              id: `bradesco2-${Date.now()}-${index}`,
              date: dateStr,
              description: description,
              amount: amount,
              category: isOwnAccount ? 'non-taxable' : 'taxable',
            };
            
            transactions.push(transaction);
          }
        });
        
        if (transactions.length === 0 && results.data.length > 5) { // Aumentado o threshold para evitar falsos positivos
            return reject(new Error('Nenhuma transação de crédito foi encontrada no arquivo do Bradesco (Formato 2). Verifique se o arquivo é um extrato válido.'));
        }

        resolve(transactions);
      },
      error: (error: Error) => {
        reject(new Error(`Erro ao processar o CSV do Bradesco (Formato 2): ${error.message}`));
      },
    });
  });
};