import { Transaction } from '@/types';

// Helper to format OFX date (YYYYMMDD...) to DD/MM/YYYY
const formatDate = (ofxDate: string): string => {
  if (!ofxDate || ofxDate.length < 8) {
    return '';
  }
  const year = ofxDate.substring(0, 4);
  const month = ofxDate.substring(4, 6);
  const day = ofxDate.substring(6, 8);
  return `${day}/${month}/${year}`;
};

export const parseSicrediOfx = async (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    try {
      const transactions: Transaction[] = [];
      
      // Regex to find transaction blocks <STMTTRN>...</STMTTRN>
      const transactionRegex = /<STMTTRN>(.*?)<\/STMTTRN>/gs;
      
      let match;
      let index = 0;

      while ((match = transactionRegex.exec(fileContent)) !== null) {
        const block = match[1];

        // Extract amount
        const amtMatch = /<TRNAMT>(.*?)(\r|\n|<)/.exec(block);
        const amount = amtMatch ? parseFloat(amtMatch[1].trim()) : 0;

        // We are only interested in credit entries (positive amounts)
        if (amount <= 0) continue;

        // Extract other fields
        const dateMatch = /<DTPOSTED>(.*?)(\r|\n|<)/.exec(block);
        const dateRaw = dateMatch ? dateMatch[1].trim() : '';
        const date = formatDate(dateRaw);

        // Sicredi often uses <MEMO> or <NAME> for description
        const memoMatch = /<MEMO>(.*?)(\r|\n|<)/.exec(block);
        const nameMatch = /<NAME>(.*?)(\r|\n|<)/.exec(block);
        
        const memoVal = memoMatch ? memoMatch[1].trim() : '';
        const nameVal = nameMatch ? nameMatch[1].trim() : '';
        
        const description = memoVal || nameVal || 'Descrição não informada';
        
        const fitidMatch = /<FITID>(.*?)(\r|\n|<)/.exec(block);
        const fitid = fitidMatch ? fitidMatch[1].trim() : `sicredi-ofx-${Date.now()}-${index}`;

        // Classification logic
        const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

        const cleanedCnpj = companyCnpj.replace(/\D/g, '');
        const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
        const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

        const isOwnAccount = 
          (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
          cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
          cleanedNameList.some(name => name && normalizedDesc.includes(name));

        transactions.push({
          id: fitid,
          date: date,
          description: description,
          amount: amount,
          category: isOwnAccount ? 'non-taxable' : 'taxable',
          sourceFile: 'Sicredi OFX'
        });

        index++;
      }

      if (transactions.length === 0) {
         if (!fileContent.includes('<OFX>')) {
            return reject(new Error('O arquivo não parece ser um OFX válido do Sicredi.'));
         }
         return reject(new Error('Nenhuma transação de crédito foi encontrada no arquivo OFX do Sicredi.'));
      }

      resolve(transactions);

    } catch (error) {
      console.error(`Erro ao processar o arquivo OFX do Sicredi:`, error);
      reject(new Error(`Ocorreu um erro inesperado ao ler o arquivo OFX do Sicredi.`));
    }
  });
};