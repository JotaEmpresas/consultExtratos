import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PreClassification = 'taxable' | 'non-taxable' | 'unclassified';

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
