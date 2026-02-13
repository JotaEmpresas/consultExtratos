"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { List, FileText } from "lucide-react";

const formats = [
  {
    name: "Banco da Amazônia",
    fields: ["DATA", "DESCRICAO_HISTORICO", "VALOR", "DC"],
  },
  {
    name: "Nubank (.csv)",
    fields: ["Data", "Valor", "Identificador", "Descrição"],
  },
  {
    name: "Itaú",
    fields: ["Data", "Lançamento", "Valor (R$)", "CNPJ/CPF (Opcional)"],
  },
  {
    name: "C6 Bank",
    fields: ["Data Lançamento", "Título", "Entrada(R$)"],
  },
  {
    name: "Mercado Pago",
    fields: ["RELEASE_DATE", "TRANSACTION_TYPE", "TRANSACTION_NET_AMOUNT"],
  },
  {
    name: "Cora",
    fields: ["Data", "Histórico", "Valor (R$)", "Tipo"],
  },
  {
    name: "Banco Tradicional (ex: BB)",
    fields: ["Data", "Histórico", "Valor", "Sinal"],
  },
  {
    name: "PagBank",
    fields: ["Data da transação", "Descrição", "Valor bruto"],
  },
  {
    name: "Inter",
    fields: ["Data", "Transação", "Tipo Transação", "Valor"],
  },
  {
    name: "PagSeguro",
    fields: ["DATA", "TIPO", "DESCRICAO", "VALOR"],
  },
  {
    name: "Bradesco",
    fields: ["Data", "Lançamento", "Crédito (R$)"],
  },
  {
    name: "Stone",
    fields: ["Movimentação", "Tipo", "Valor", "Data", "Origem", "Origem Documento"],
  },
  {
    name: "InfinitPay",
    fields: ["Date", "Transaction Type", "Name", "Detail", "Amount"],
  },
];

export const SupportedFormats = () => {
  return (
    <div className="mt-6">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
              <List className="h-4 w-4" />
              Ver formatos de extrato suportados
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                A aplicação identifica automaticamente o layout do seu arquivo .csv ou .ofx. Garanta que seu extrato contenha as seguintes colunas para um dos formatos abaixo:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {formats.map((format) => (
                  <div key={format.name} className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-900">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      {format.name}
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {format.fields.map((field) => (
                        <Badge key={field} variant="secondary" className="text-xs font-normal">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};