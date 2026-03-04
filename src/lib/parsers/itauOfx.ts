import { parse } from 'ofx-js';
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

export const parseItauOfx = async (
  fileContent: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  try {
    const ofxData = await parse(fileContent);
    const statement = ofxData.OFX.BANKMSGSRSV1?.STMTTRNRS?.STMTRS;
    let transactions = statement?.BANKTRANLIST?.STMTTRN;

    if (!transactions) {
      console.warn("Nenhuma transação encontrada no arquivo OFX do Itaú.");
      return [];
    }

    // Ensure transactions is an array, as ofx-js might return a single object
    if (!Array.isArray(transactions)) {
      transactions = [transactions];
    }

    const cleanedCnpj = companyCnpj.replace(/\D/g, '');
    const cleanedCpfList = cpfList.map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
    const cleanedNameList = nameList.map(name => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()).filter(Boolean);

    return transactions
      // Filter for credit transactions (positive amount), which is more reliable than TRNTYPE
      .filter(t => parseFloat(t.TRNAMT) > 0)
      .map((t, index) => {
        const description = t.MEMO || '';
        const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

        const isOwnAccount = 
          (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
          cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
          cleanedNameList.some(name => name && normalizedDesc.includes(name));

        return {
          id: `itau-ofx-${t.FITID || index}`,
          date: formatDate(t.DTPOSTED),
          description: description,
          amount: parseFloat(t.TRNAMT),
          sourceFile: 'Itaú OFX',
          category: isOwnAccount ? 'non-taxable' : 'taxable',
        };
      });
  } catch (error) {
    console.error(`Erro ao processar o arquivo OFX do Itaú:`, error);
    throw new Error(`O arquivo OFX parece estar mal formatado ou não é um extrato bancário válido. Detalhes: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};