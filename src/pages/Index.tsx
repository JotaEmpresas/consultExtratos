import { useState } from "react";
import { AnalysisForm } from "@/components/AnalysisForm";
import { AnalysisResult } from "@/components/AnalysisResult";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { parsers } from "@/lib/parserRegistry";
import { readFilesForWebhook } from "@/lib/fileReader";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { Transaction, AnalysisData, AiAnalysisResult, Invoice } from "@/types";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AIComparisonReport } from "@/components/AIComparisonReport";
import { parseInvoices } from "@/lib/invoiceParser";

type AnalysisStep = 'input' | 'result';

const Index = () => {
  const [step, setStep] = useState<AnalysisStep>('input');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AiAnalysisResult | null>(null);
  const [aiAnalysisText, setAiAnalysisText] = useState<string>("");
  const [corsError, setCorsError] = useState(false);

  const getWebhookUrl = (type: 'prod' | 'test') => {
    const prodUrl = localStorage.getItem('prodWebhookUrl') || 'https://jota-empresas-n8n.ubjifz.easypanel.host/webhook/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e';
    const testUrl = localStorage.getItem('testWebhookUrl') || 'https://jota-empresas-n8n.ubjifz.easypanel.host/webhook-test/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e';
    return type === 'test' ? testUrl : prodUrl;
  };

  const handleProcessAnalysis = async (data: Omit<AnalysisData, 'totalInvoices'>, bankFiles: { bank: string, files: File[] }[], invoiceFiles: File[]) => {
    setIsProcessing(true);
    setCorsError(false);
    const toastId = showLoading("Processando arquivos, por favor aguarde...");

    try {
      // Determine total invoices based on mode
      let totalAmount = "0";
      let parsedInvoices: Invoice[] = [];

      if (data.manualRevenue !== undefined) {
        // Manual revenue mode
        totalAmount = data.manualRevenue.toString();
        setInvoices([]);
      } else {
        // Parse invoices from files
        const result = await parseInvoices(invoiceFiles);
        parsedInvoices = result.invoices;
        totalAmount = result.totalAmount.toString();
        
        if (parsedInvoices.length === 0) {
          throw new Error("Nenhuma nota fiscal válida foi encontrada. Verifique o formato dos arquivos (XML).");
        }
        setInvoices(parsedInvoices);
      }

      const fullAnalysisData: AnalysisData = {
        ...data,
        totalInvoices: totalAmount,
      };

      const cpfList = data.cpf.split(',').map(s => s.trim()).filter(Boolean);
      const nameList = data.partnerNames.split(',').map(s => s.trim()).filter(Boolean);
      
      let allTransactions: Transaction[] = [];

      for (const { bank, files } of bankFiles) {
        const parser = parsers[bank];
        if (!parser) {
          showError(`Parser para o banco selecionado (${bank}) não foi encontrado. Pulando...`);
          continue;
        }

        const filesContent = await readFilesForWebhook(files);
        if (filesContent.length === 0) {
            showError(`Nenhum arquivo do banco ${bank} pôde ser lido. Pulando...`);
            continue;
        }

        for (const file of filesContent) {
          try {
            const parsedTransactions = await parser(file.content, data.cnpj, cpfList, nameList);
            const transactionsWithSource = parsedTransactions.map((t, i) => ({ ...t, id: t.id || `${file.fileName}-${i}`, sourceFile: file.fileName }));
            allTransactions.push(...transactionsWithSource);
          } catch (error) {
            showError(`Erro ao processar o arquivo ${file.fileName}: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
          }
        }
      }

      if (allTransactions.length === 0) {
        throw new Error("Nenhuma transação de crédito válida foi encontrada nos arquivos. Verifique o formato e o conteúdo.");
      }
      
      setTransactions(allTransactions);
      setAnalysisData(fullAnalysisData);
      setAiAnalysisText("Análise local concluída. Os dados abaixo foram extraídos e classificados automaticamente.");
      
      setStep('result');
      dismissToast(toastId);
      showSuccess("Processamento local concluído!");

    } catch (error) {
      console.error("Erro no processo de análise:", error);
      dismissToast(toastId);
      showError(error instanceof Error ? error.message : "Ocorreu um erro desconhecido.");
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
    setInvoices([]);
    setAnalysisData(null);
    setAiAnalysisText("");
    setCorsError(false);
    setAiResult(null);
  };

  const handleReanalyzeAi = async (type: 'prod' | 'test') => {
    setIsAiProcessing(true);
    setCorsError(false);
    let toastId = showLoading("Analisando com IA, isso pode levar um momento...");

    try {
      const webhookUrl = getWebhookUrl(type);

      // Pre-process and filter transactions to reduce payload size
      const filteredTransactions = transactions.filter(t => {
        // Rule 1: Remove very small transactions (likely noise/fees)
        if (t.amount < 1.00) {
          return false;
        }

        // Rule 2: Remove transactions confidently classified as non-taxable (e.g., internal transfers)
        if (t.category === 'non-taxable') {
          const preClassification = preClassifyTransaction(t.description);
          // If our keyword-based check also confirms it's non-taxable, it's safe to filter out
          if (preClassification === 'non-taxable') {
            return false;
          }
        }
        
        return true;
      });

      const payload = {
        analysisData,
        transactions: filteredTransactions,
        invoices,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro na chamada do webhook: ${response.statusText} (${response.status})`);
      }

      const result: AiAnalysisResult = await response.json();
      setAiResult(result);
      dismissToast(toastId);
      showSuccess("Análise da IA concluída!");

    } catch (error) {
      console.error("Erro na análise com IA:", error);
      dismissToast(toastId);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        setCorsError(true);
        showError("Erro de conexão com o webhook. Verifique a configuração de CORS no seu servidor n8n.");
      } else {
        showError(error instanceof Error ? error.message : "Ocorreu um erro desconhecido na análise com IA.");
      }
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="py-4 px-4 md:px-8 no-print flex justify-between items-center bg-white dark:bg-gray-950 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400">
          Analisador Financeiro
        </h1>
        <SettingsSheet />
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 print-container">
        {step === 'input' && (
          <div className="space-y-6">
            {corsError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro de Configuração (CORS)</AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="mb-2">O navegador bloqueou a conexão com o n8n. Isso ocorre por segurança quando o servidor não permite explicitamente a origem.</p>
                  <p className="font-semibold">Como resolver:</p>
                  <ol className="list-decimal list-inside ml-2">
                    <li>No seu workflow n8n, abra o nó <strong>Webhook</strong>.</li>
                    <li>Vá em <strong>Options</strong>.</li>
                    <li>Encontre a opção <strong>Allowed Origins (CORS)</strong>.</li>
                    <li>Defina o valor como <code>*</code>.</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}

            <AnalysisForm onSubmit={handleProcessAnalysis} isProcessing={isProcessing} />
          </div>
        )}
        
        {step === 'result' && analysisData && !aiResult && (
          <div className="space-y-6">
            <AnalysisResult 
              transactions={transactions} 
              analysisData={analysisData}
              onBack={handleNewAnalysis}
              onToggleCategory={handleToggleTransactionCategory}
              onAiAnalysis={handleReanalyzeAi}
              isAiProcessing={isAiProcessing}
            />
          </div>
        )}

        {step === 'result' && analysisData && aiResult && (
           <AIComparisonReport 
            originalTransactions={transactions}
            aiResult={aiResult}
            analysisData={analysisData}
            onBack={() => setAiResult(null)}
          />
        )}
      </main>
      
      <footer className="py-4 no-print border-t mt-auto">
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Index;