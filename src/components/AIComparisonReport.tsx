import { Transaction, AnalysisData, AiAnalysisResult } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from './ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from './ui/badge';
import { BookOpen, Bot } from 'lucide-react';

interface AIComparisonReportProps {
  originalTransactions: Transaction[];
  aiResult: AiAnalysisResult;
  analysisData: AnalysisData;
  onBack: () => void;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const DisplayTable = ({ title, transactions }: { title: string, transactions: Transaction[] }) => {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">{title} <Badge variant="secondary">{transactions.length}</Badge></CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[300px] overflow-y-auto relative">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t, index) => (
                <TableRow key={`${t.id}-${index}`}>
                  <TableCell className="text-xs">{t.date}</TableCell>
                  <TableCell className="text-sm">{t.description}</TableCell>
                  <TableCell className="text-right font-medium text-sm">{formatCurrency(t.amount)}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground h-24">Nenhuma transação</TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export const AIComparisonReport = ({ originalTransactions, aiResult, analysisData, onBack }: AIComparisonReportProps) => {
  const originalTaxable = originalTransactions.filter(t => t.category === 'taxable');
  const originalNonTaxable = originalTransactions.filter(t => t.category === 'non-taxable');

  const aiTaxable = aiResult["lista de Valores Tributados"] || [];
  const aiNonTaxable = aiResult["Lista de Valores Possíveis não Tributáveis"] || [];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Card className="shadow-lg border-indigo-100 dark:border-indigo-900">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center gap-2"><Bot /> Relatório Comparativo da IA</CardTitle>
              <CardDescription>
                Análise para <strong>{analysisData.cnpj}</strong> referente a <strong>{format(analysisData.competenceDate, "MMMM 'de' yyyy", { locale: ptBR })}</strong>
              </CardDescription>
            </div>
            <Button onClick={onBack} variant="outline">Nova Análise</Button>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold mb-2">Análise da IA:</h3>
          <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md border">{aiResult.analise}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-center">Sua Análise Original</h2>
          <DisplayTable title="Entradas Tributáveis" transactions={originalTaxable} />
          <DisplayTable title="Entradas Não Tributáveis" transactions={originalNonTaxable} />
        </div>
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-center">Análise Sugerida pela IA</h2>
          <DisplayTable title="Entradas Tributáveis (IA)" transactions={aiTaxable} />
          <DisplayTable title="Entradas Não Tributáveis (IA)" transactions={aiNonTaxable} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BookOpen /> Base de Conhecimento da IA</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Handles both old typo key and new corrected key if backend is inconsistent */}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {aiResult["legislação base de conhecimento"] || (aiResult as any)["legislação bse de conhecimento"]}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};