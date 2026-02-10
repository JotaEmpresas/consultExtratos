import { useState } from "react";
import { AnalysisForm } from "@/components/AnalysisForm";
import { AnalysisResult } from "@/components/AnalysisResult";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { parseFiles } from "@/lib/fileParser";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { Transaction, AnalysisData, AiAnalysisResult } from "@/types";
import { SettingsSheet } from "@/components/SettingsSheet";
import { AIComparisonReport } from "@/components/AIComparisonReport";

type AnalysisStep = 'input' | 'result' | 'ai-comparison';

const Index = () => {
  const [step, setStep] = useState<AnalysisStep>('input');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AiAnalysisResult | null>(null);

  const handleProcessAnalysis = async (data: AnalysisData, files: File[]) => {
    setIsProcessing(true);
    try {
      const allParsedTransactions = await parseFiles(files, data.cnpj, data.cpf);
      console.log(`[Filtro] Total de transações extraídas dos arquivos: ${allParsedTransactions.length}`);
      
      const selectedMonth = data.competenceDate.getMonth();
      const selectedYear = data.competenceDate.getFullYear();
      console.log(`[Filtro] Mês selecionado: ${selectedMonth + 1}, Ano selecionado: ${selectedYear}`);

      const filteredTransactions = allParsedTransactions.filter(t => {
        if (!t.date) return false;
        
        const parts = t.date.split('/');
        if (parts.length !== 3) {
          console.warn(`[Filtro] Data em formato inválido: ${t.date}`);
          return false;
        }

        const transactionMonth = parseInt(parts[1], 10) - 1;
        const transactionYear = parseInt(parts[2], 10);

        const matches = transactionMonth === selectedMonth && transactionYear === selectedYear;
        
        if (!matches && allParsedTransactions.length < 10) {
           console.log(`[Filtro] Descartando: ${t.date} (Mês ${transactionMonth + 1}, Ano ${transactionYear})`);
        }

        return matches;
      });

      console.log(`[Filtro] Transações que passaram no filtro de data: ${filteredTransactions.length}`);

      filteredTransactions.sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('');
        const dateB = b.date.split('/').reverse().join('');
        return dateA.localeCompare(dateB);
      });

      if (filteredTransactions.length === 0 && allParsedTransactions.length > 0) {
        showError("Nenhuma transação encontrada para o mês/ano selecionado. Verifique se o arquivo corresponde ao período.");
      }

      setTransactions(filteredTransactions);
      setAnalysisData(data);
      setStep('result');
      showSuccess("Análise concluída!");
    } catch (error) {
      console.error("Erro ao processar arquivos:", error);
      showError("Erro ao processar os arquivos.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleTransactionCategory = (transactionId: string) => {
    setTransactions(prevTransactions =>
      prevTransactions.map(t =>
        t.id === transactionId
          ? { ...t, category: t.category === 'taxable' ? 'non-taxable' : 'taxable' }
          : t
      )
    );
  };

  const handleNewAnalysis = () => {
    setStep('input');
    setTransactions([]);
    setAnalysisData(null);
    setAiAnalysisResult(null);
  };

  const handleAiAnalysis = async (type: 'prod' | 'test') => {
    const webhookUrl = localStorage.getItem(type === 'prod' ? 'prodWebhookUrl' : 'testWebhookUrl');
    if (!webhookUrl) {
      showError(`URL do webhook de ${type === 'prod' ? 'produção' : 'teste'} não configurado.`);
      return;
    }

    setIsAiProcessing(true);
    const toastId = showLoading('Enviando dados para análise da IA...');

    try {
      const payload = {
        analysisData,
        taxableTransactions: transactions.filter(t => t.category === 'taxable'),
        nonTaxableTransactions: transactions.filter(t => t.category === 'non-taxable'),
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro na comunicação com o webhook: ${response.statusText}`);
      }

      const result: AiAnalysisResult = await response.json();
      setAiAnalysisResult(result);
      setStep('ai-comparison');
      dismissToast(toastId);
      showSuccess('Análise da IA recebida com sucesso!');

    } catch (error) {
      console.error("Erro na análise com IA:", error);
      dismissToast(toastId);
      showError("Falha ao obter análise da IA.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="py-4 px-4 md:px-8 no-print flex justify-between items-center">
        <h1 className="text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400">
          Analisador de Extratos
        </h1>
        <SettingsSheet />
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-8 print-container">
        {step === 'input' && (
          <AnalysisForm onSubmit={handleProcessAnalysis} isProcessing={isProcessing} />
        )}
        {step === 'result' && analysisData && (
          <AnalysisResult 
            transactions={transactions} 
            analysisData={analysisData}
            onBack={handleNewAnalysis}
            onToggleCategory={handleToggleTransactionCategory}
            onAiAnalysis={handleAiAnalysis}
            isAiProcessing={isAiProcessing}
          />
        )}
        {step === 'ai-comparison' && analysisData && aiAnalysisResult && (
          <AIComparisonReport
            originalTransactions={transactions}
            aiResult={aiAnalysisResult}
            analysisData={analysisData}
            onBack={handleNewAnalysis}
          />
        )}
      </main>
      <footer className="py-4 no-print">
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Index;