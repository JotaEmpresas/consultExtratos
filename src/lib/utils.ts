import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PreClassification = 'taxable' | 'non-taxable' | 'unclassified';

/**
 * Normaliza uma string removendo acentos e convertendo para lowercase
 */
export const normalizeText = (text: string): string => {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Extrai apenas números de um texto
 */
export const extractNumbers = (text: string): string => {
  return text.replace(/[^0-9]/g, '');
};

/**
 * Categoriza uma transação como Tributável ou Não-Tributável
 * 
 * Entradas Tributáveis: Apenas entradas positivas que NÃO contenha CNPJ/CPF/nome de sócios
 * Entradas Não-Tributáveis: Entradas positivas que contenham CNPJ da empresa ou CPF dos sócios
 * 
 * @param description Descrição da transação
 * @param companyCnpj CNPJ da empresa
 * @param cpfList Lista de CPFs dos sócios
 * @param nameList Lista de nomes dos sócios/clientes
 * @returns 'taxable' ou 'non-taxable'
 */
export const categorizeTransaction = (
  description: string,
  companyCnpj: string,
  cpfList: string[],
  nameList: string[],
  amount: number = 0
): 'taxable' | 'non-taxable' | 'payment' => {
  // Se é um pagamento/débito (valor negativo), classifica como payment
  if (amount < 0) {
    return 'payment';
  }

  // Exclui transações de saldo ou resumo
  if (isBalanceOrSummary(description)) {
    return 'taxable'; // Será filtrado no upstream
  }

  // Normalizar dados para comparação
  const normalizedDesc = normalizeText(description);
  const numbersOnlyDesc = extractNumbers(description);

  const cleanedCnpj = extractNumbers(companyCnpj);
  const cleanedCpfList = cpfList
    .map(cpf => extractNumbers(cpf))
    .filter(Boolean);

  const cleanedNameList = nameList
    .map(name => normalizeText(name).trim())
    .filter(Boolean);

  // Verifica se contém identificadores da empresa ou sócios (indica transferência interna)
  const isOwnAccountOrPartner =
    (cleanedCnpj && numbersOnlyDesc.includes(cleanedCnpj)) ||
    cleanedCpfList.some(cpf => cpf && numbersOnlyDesc.includes(cpf)) ||
    cleanedNameList.some(name => name && normalizedDesc.includes(name));

  return isOwnAccountOrPartner ? 'non-taxable' : 'taxable';
};

export const preClassifyTransaction = (description: string): PreClassification => {
  const desc = description.toUpperCase();

  const taxableKeywords = [
    'PIX QRS', 'RECEBIMENTO REDE', 'REDECARD', 'VISA', 'MASTERCARD', 'ELO', 'ALELO',
    'CIELO', 'GETNET', 'STONE', 'PAGSEGURO', 'PAGBANK', 'PICPAY', 'MERCADOPAGO', 'MERCADO PAGO',
    'RENDIMENTOS', 'APLICAÇÃO', 'APLIC AUT MAIS', 
  ];

  const nonTaxableKeywords = [
    'TRANSFERENCIA', 'TED', 'DOC', 'TRANSF.',
  ];

  if (taxableKeywords.some(k => desc.includes(k))) {
    return 'taxable';
  }

  if (nonTaxableKeywords.some(k => desc.includes(k))) {
    return 'non-taxable';
  }

  // Specific case for "PIX RECEBIDO" which is ambiguous
  if (desc.includes('PIX RECEBIDO')) {
    // If it also contains company name identifiers, it's likely a transfer, but that logic is in the parser.
    // Without more context, it's hard to classify. We leave it as unclassified for the main parser logic to handle.
    return 'unclassified';
  }
  
  if (desc.includes('SALDO ANTERIOR')) {
    return 'unclassified'; // Or a more specific category to be ignored
  }

  return 'unclassified';
};

/**
 * Verifica se uma transação é um saldo, resumo ou informação que deve ser ignorada
 */
export const isBalanceOrSummary = (description: string): boolean => {
  const excludePatterns = [
    'SALDO TOTAL DISPONÍVEL DIA',
    'SALDO TOTAL DISPONÍVEL',
    'SALDO ANTERIOR',
    'SALDO EM',
    'SALDO FINAL',
    'RESUMO MENSAL',
    'RESUMO DO DIA',
    'RESUMEN DIARIO',
    'EXTRATO RESUMIDO',
    'RENDIMENTOS REND PAGO',
    'REND PAGO APLIC',
  ];

  const descupper = description.toUpperCase().trim();
  return excludePatterns.some(pattern => descupper.includes(pattern));
};
