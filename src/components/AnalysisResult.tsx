import { Transaction, AnalysisData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from './ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnalysisResultProps {
  transactions: Transaction[];
  analysisData: AnalysisData;
  onBack: () => void;
}

export const AnalysisResult = ({ transactions, analysisData, onBack }: AnalysisResultProps) => {
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = parseFloat(analysisData.totalInvoices.replace(',', '.')) || 0;
  const difference = totalAmount - totalInvoices;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className="shadow-lg border-indigo-100 dark:border-indigo-900">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Resultado da Análise</CardTitle>
            <CardDescription>
              Análise para {analysisData.cnpj} referente a {format(analysisData.competenceDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <Button onClick={onBack} variant="outline">Nova Análise</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-muted-foreground">Total das Notas</p>
            <p className="text-2xl font-bold">{formatCurrency(totalInvoices)}</p>
          </div>
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-muted-foreground">Total de Entradas</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
          </div>
          <div className={`p-4 rounded-lg ${difference > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-green-100 dark:bg-green-900/50'}`}>
            <p className="text-sm text-muted-foreground">Diferença</p>
            <p className={`text-2xl font-bold ${difference > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(difference)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border-indigo-100 dark:border-indigo-900">
        <CardHeader>
          <CardTitle>Transações de Entrada Identificadas</CardTitle>
          <CardDescription>Total de {transactions.length} transações encontradas nos extratos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Arquivo de Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.date}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.sourceFile}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};