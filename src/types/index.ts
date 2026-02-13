export type TransactionCategory = 'taxable' | 'non-taxable';

export interface Transaction {
  id?: string; // Opcional, geramos no front se vier vazio
  date: string; // Esperado DD/MM/AAAA
  description: string;
  amount: number;
  sourceFile?: string;
  category: TransactionCategory;
}

export interface AnalysisData {
  cnpj: string;
  cpf: string;
  partnerNames: string;
  totalInvoices: string;
  competenceDate: Date;
}

// Estrutura que o seu Webhook DEVE retornar
export interface AiProcessingResponse {
  analise: string; // O texto/parecer da IA
  transacoesTributaveis: Transaction[];
  transacoesNaoTributaveis: Transaction[];
}

export interface AiAnalysisResult {
  analise: string;
  "lista de Valores Tributados": Transaction[];
  "Lista de Valores Possíveis não Tributáveis": Transaction[];
  "legislação bse de conhecimento": string;
}