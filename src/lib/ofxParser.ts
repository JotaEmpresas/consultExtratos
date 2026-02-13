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

export const parseOfxFile = async (
  fileContent: string,
  fileName: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[]
): Promise<Transaction[]> => {
  try {
    const ofxData = await parse(fileContent);
    const statement = ofxData.OFX.BANKMSGSRSV1?.STMTTRNRS?.STMTRS;
    const transactions = statement?.BANKTRANLIST?.STMTTRN;

    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }

    return transactions
      .filter(t => t.TRNTYPE === 'CREDIT' && parseFloat(t.TRNAMT) > 0)
      .map((t, index) => {
        const description = t.MEMO || '';
        const normalizedDesc = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const numbersOnlyDesc = normalizedDesc.replace(/[^0-9]/g, '');

        const isOwnAccount = 
          (companyCnpj && numbersOnlyDesc.includes(companyCnpj)) ||
          cpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
          nameList.some(name => name && normalizedDesc.includes(name));

        return {
          id: `${fileName}-ofx-${index}`,
          date: formatDate(t.DTPOSTED),
          description: description,
          amount: parseFloat(t.TRNAMT),
          sourceFile: fileName,
          category: isOwnAccount ? 'non-taxable' : 'taxable',
        };
      });
  } catch (error) {
    console.error(`Erro ao processar o arquivo OFX ${fileName}:`, error);
    return [];
  }
};