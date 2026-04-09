import { Transaction, AnalysisData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from './ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRightCircle, ArrowLeftCircle, Printer, Banknote, BrainCircuit, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { isBalanceOrSummary } from '@/lib/utils';

interface AnalysisResultProps {
  transactions: Transaction[];
  analysisData: AnalysisData;
  onBack: () => void;
  onToggleCategory: (transactionId: string) => void;
  onAiAnalysis: (type: 'prod' | 'test') => void;
  isAiProcessing: boolean;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const InteractiveTransactionTable = ({ title, transactions, total, actionButton }: { title: string, transactions: Transaction[], total: number, actionButton: (t: Transaction) => React.ReactNode }) => (
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
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs">{t.date}</TableCell>
                <TableCell className="text-sm">{t.description}</TableCell>
                <TableCell className="text-right font-medium text-sm">{formatCurrency(t.amount)}</TableCell>
                <TableCell>{actionButton(t)}</TableCell>
              </TableRow>
            ))}
             {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground h-24">Nenhuma transação</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </CardContent>
  </Card>
);

const PrintableTable = ({ title, transactions, total }: { title: string, transactions: Transaction[], total: number }) => (
  <div>
    <h3 className="text-lg font-semibold mb-2">{title} ({transactions.length})</h3>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map(t => (
          <TableRow key={t.id}>
            <TableCell>{t.date}</TableCell>
            <TableCell>{t.description}</TableCell>
            <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2} className="font-bold">Total</TableCell>
          <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  </div>
);

const PrintableReport = ({ transactions, analysisData }: { transactions: Transaction[], analysisData: AnalysisData }) => {
  // Filtra transações de saldo e resumo
  const filteredTransactions = transactions.filter(t => !isBalanceOrSummary(t.description));
  
  const totalTaxableAmount = filteredTransactions.filter(t => t.category === 'taxable').reduce((sum, t) => sum + t.amount, 0);
  const totalNonTaxableAmount = filteredTransactions.filter(t => t.category === 'non-taxable').reduce((sum, t) => sum + t.amount, 0);
  const totalPaymentAmount = filteredTransactions.filter(t => t.category === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = parseFloat(analysisData.totalInvoices.replace(',', '.')) || 0;
  const entradaTotal = totalTaxableAmount + totalNonTaxableAmount;
  const entradasTributaveis = totalTaxableAmount;
  const diferenca = totalInvoices - entradasTributaveis;

  const groupedByBank = filteredTransactions.filter(t => t.category !== 'payment').reduce((acc, t) => {
    const key = t.sourceFile;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const paymentsGroupedByBank = filteredTransactions.filter(t => t.category === 'payment').reduce((acc, t) => {
    const key = t.sourceFile;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="hidden print-only">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Relatório de Análise Financeira</h1>
        <p><strong>Empresa:</strong> {analysisData.companyName}</p>
        <p><strong>CNPJ:</strong> {analysisData.cnpj}</p>
        <p><strong>Mês de Competência:</strong> {format(analysisData.competenceDate, "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      <div className="grid grid-cols-5 gap-4 text-center mb-8 border p-4 rounded-lg">
        <div><p className="text-sm">Total das Notas</p><p className="font-bold">{formatCurrency(totalInvoices)}</p></div>
        <div><p className="text-sm">Entrada Total</p><p className="font-bold">{formatCurrency(entradaTotal)}</p></div>
        <div><p className="text-sm">Entradas Não Tributáveis</p><p className="font-bold">{formatCurrency(totalNonTaxableAmount)}</p></div>
        <div><p className="text-sm">Entradas Tributáveis</p><p className="font-bold">{formatCurrency(entradasTributaveis)}</p></div>
        <div><p className="text-sm">Diferença (lançar no Imposto)</p><p className="font-bold">{formatCurrency(diferenca)}</p></div>
      </div>

      <div className="mb-8" style={{ pageBreakAfter: 'always' }}>
        <h2 className="text-xl font-bold mb-4 text-center">Resumo por Extrato</h2>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(groupedByBank).map(([bankName, bankTransactions]) => {
            const entradasTributaveis = bankTransactions.filter(t => t.category === 'taxable').reduce((sum, t) => sum + t.amount, 0);
            const entradasNaoTributaveis = bankTransactions.filter(t => t.category === 'non-taxable').reduce((sum, t) => sum + t.amount, 0);
            const entradaTotal = entradasTributaveis + entradasNaoTributaveis;

            return (
              <div key={bankName} className="p-4 border rounded-lg" style={{ breakInside: 'avoid' }}>
                <h3 className="font-bold text-lg mb-2 truncate">{bankName}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Entradas Tributáveis:</span> <span className="font-medium">{formatCurrency(entradasTributaveis)}</span></div>
                  <div className="flex justify-between"><span>Entradas Não Tributáveis:</span> <span className="font-medium">{formatCurrency(entradasNaoTributaveis)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><strong>Entrada Total:</strong> <strong>{formatCurrency(entradaTotal)}</strong></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedByBank).map(([bankName, bankTransactions]) => {
          const taxable = bankTransactions.filter(t => t.category === 'taxable');
          const nonTaxable = bankTransactions.filter(t => t.category === 'non-taxable');
          const totalTaxable = taxable.reduce((sum, t) => sum + t.amount, 0);
          const totalNonTaxable = nonTaxable.reduce((sum, t) => sum + t.amount, 0);
          const totalForBank = totalTaxable + totalNonTaxable;

          return (
            <div key={bankName} className="p-4 border rounded-lg" style={{ breakInside: 'avoid' }}>
              <h2 className="text-xl font-bold mb-2 border-b pb-2">{bankName}</h2>
              <div className="grid grid-cols-3 gap-4 text-center my-4 text-sm">
                <div className="p-2 bg-gray-100 rounded">
                    <p className="font-semibold">Tributável</p>
                    <p>{formatCurrency(totalTaxable)}</p>
                </div>
                <div className="p-2 bg-gray-100 rounded">
                    <p className="font-semibold">Não Tributável</p>
                    <p>{formatCurrency(totalNonTaxable)}</p>
                </div>
                <div className="p-2 bg-gray-200 rounded">
                    <p className="font-bold">Total do Extrato</p>
                    <p className="font-bold">{formatCurrency(totalForBank)}</p>
                </div>
              </div>
              <div className="space-y-6">
                {taxable.length > 0 && <PrintableTable title="Detalhe - Entradas Tributáveis" transactions={taxable} total={totalTaxable} />}
                {nonTaxable.length > 0 && <PrintableTable title="Detalhe - Entradas Não Tributáveis" transactions={nonTaxable} total={totalNonTaxable} />}
              </div>
            </div>
          );
        })}

        {Object.entries(paymentsGroupedByBank).length > 0 && (
          <div style={{ pageBreakAfter: 'always' }}>
            <h2 className="text-xl font-bold mb-4 text-center">Pagamentos e Saídas</h2>
            <div className="space-y-8">
              {Object.entries(paymentsGroupedByBank).map(([bankName, payments]) => {
                const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);
                return (
                  <div key={bankName} className="p-4 border rounded-lg" style={{ breakInside: 'avoid' }}>
                    <h3 className="text-lg font-bold mb-2 border-b pb-2">{bankName}</h3>
                    <PrintableTable title="Pagamentos e Saídas" transactions={payments} total={totalPayments} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AnalysisResult = ({ transactions, analysisData, onBack, onToggleCategory, onAiAnalysis, isAiProcessing }: AnalysisResultProps) => {
  // Filtra transações de saldo e resumo
  const filteredTransactions = transactions.filter(t => !isBalanceOrSummary(t.description));
  
  const totalTaxableAmount = filteredTransactions.filter(t => t.category === 'taxable').reduce((sum, t) => sum + t.amount, 0);
  const totalNonTaxableAmount = filteredTransactions.filter(t => t.category === 'non-taxable').reduce((sum, t) => sum + t.amount, 0);
  const totalPaymentAmount = filteredTransactions.filter(t => t.category === 'payment').reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = parseFloat(analysisData.totalInvoices.replace(',', '.')) || 0;
  const entradaTotal = totalTaxableAmount + totalNonTaxableAmount;
  const entradasTributaveis = totalTaxableAmount;
  const diferenca = totalInvoices - entradasTributaveis;

  const groupedByBank = filteredTransactions.filter(t => t.category !== 'payment').reduce((acc, t) => {
    const key = t.sourceFile;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const paymentsGroupedByBank = filteredTransactions.filter(t => t.category === 'payment').reduce((acc, t) => {
    const key = t.sourceFile;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="no-print">
        <Card className="shadow-lg border-indigo-100 dark:border-indigo-900">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-semibold">{analysisData.companyName}</CardTitle>
                <CardDescription>
                  Análise para o CNPJ <strong>{analysisData.cnpj}</strong> referente a <strong>{format(analysisData.competenceDate, "MMMM 'de' yyyy", { locale: ptBR })}</strong>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button disabled={isAiProcessing}>
                      {isAiProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
                      Analisar com IA
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onAiAnalysis('prod')}>Produção</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAiAnalysis('test')}>Teste</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => window.print()} variant="outline"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
                <Button onClick={onBack} variant="outline">Nova Análise</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"><p className="text-sm text-muted-foreground">Total das Notas</p><p className="text-2xl font-bold">{formatCurrency(totalInvoices)}</p></div>
            <div className="p-4 bg-blue-100 dark:bg-blue-900/50 rounded-lg"><p className="text-sm text-muted-foreground">Entrada Total</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(entradaTotal)}</p></div>
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg"><p className="text-sm text-muted-foreground">Entradas Não Tributáveis</p><p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalNonTaxableAmount)}</p></div>
            <div className="p-4 bg-green-100 dark:bg-green-900/50 rounded-lg"><p className="text-sm text-muted-foreground">Entradas Tributáveis</p><p className="text-2xl font-bold text-green-600">{formatCurrency(entradasTributaveis)}</p></div>
            <div className={`p-4 rounded-lg ${diferenca < 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-green-100 dark:bg-green-900/50'}`}><p className="text-sm text-muted-foreground">Diferença (lançar no Imposto)</p><p className={`text-2xl font-bold ${diferenca < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(diferenca)}</p></div>
            <div className="p-4 bg-red-100 dark:bg-red-900/50 rounded-lg md:col-span-1"><p className="text-sm text-muted-foreground">Total de Pagamentos</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalPaymentAmount)}</p></div>
          </CardContent>
        </Card>
        
        <div className="space-y-8">
          {Object.entries(groupedByBank).map(([bankName, bankTransactions]) => {
            const taxable = bankTransactions.filter(t => t.category === 'taxable');
            const nonTaxable = bankTransactions.filter(t => t.category === 'non-taxable');
            const totalTaxable = taxable.reduce((sum, t) => sum + t.amount, 0);
            const totalNonTaxable = nonTaxable.reduce((sum, t) => sum + t.amount, 0);

            return (
              <Card key={bankName} className="shadow-lg border-gray-200 dark:border-gray-700 overflow-hidden">
                <CardHeader className="bg-gray-50 dark:bg-gray-900/50">
                  <CardTitle className="flex items-center gap-3 text-lg font-semibold text-indigo-700 dark:text-indigo-400">
                    <Banknote className="h-6 w-6" /> {bankName}
                  </CardTitle>
                  <CardDescription>
                    Total do extrato: <span className="font-semibold text-foreground">{formatCurrency(totalTaxable + totalNonTaxable)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <InteractiveTransactionTable title="Entradas Tributáveis" transactions={taxable} total={totalTaxable} actionButton={(t) => (<Button variant="ghost" size="icon" onClick={() => onToggleCategory(t.id)} title="Mover para Não Tributável"><ArrowRightCircle className="h-5 w-5 text-yellow-600" /></Button>)} />
                  <InteractiveTransactionTable title="Entradas Não Tributáveis" transactions={nonTaxable} total={totalNonTaxable} actionButton={(t) => (<Button variant="ghost" size="icon" onClick={() => onToggleCategory(t.id)} title="Mover para Tributável"><ArrowLeftCircle className="h-5 w-5 text-green-600" /></Button>)} />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {Object.entries(paymentsGroupedByBank).length > 0 && (
          <Card className="shadow-lg border-red-200 dark:border-red-700 mt-8 overflow-hidden">
            <CardHeader className="bg-red-50 dark:bg-red-900/50">
              <CardTitle className="text-lg font-semibold text-red-700 dark:text-red-400">
                Pagamentos e Saídas ({transactions.filter(t => t.category === 'payment').length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-6">
                {Object.entries(paymentsGroupedByBank).map(([bankName, payments]) => {
                  const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);
                  return (
                    <div key={bankName} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-4">{bankName}</h3>
                      <InteractiveTransactionTable 
                        title="Pagamentos e Saídas" 
                        transactions={payments} 
                        total={totalPayments} 
                        actionButton={() => null}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <PrintableReport transactions={transactions} analysisData={analysisData} />
    </div>
  );
};