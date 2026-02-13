import { useState } from "react";
import { AnalysisForm } from "@/components/AnalysisForm";
import { AnalysisResult } from "@/components/AnalysisResult";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { readFilesForWebhook } from "@/lib/fileParser";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { Transaction, AnalysisData, AiProcessingResponse } from "@/types";
import { SettingsSheet } from "@/components/SettingsSheet";

type AnalysisStep = 'input' | 'result';

const Index = () => {
  const [step, setStep] = useState<AnalysisStep>('input');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiAnalysisText, setAiAnalysisText] = useState<string>("");

  // Recupera URL do webhook (padrão production ou test se o usuário tiver alguma flag, aqui simplificamos para Prod como principal)
  const getWebhookUrl = () => {
     // Prioriza a URL salva no localStorage, senão usa a padrão
     return localStorage.getItem('prodWebhookUrl') || 'https://jota-empresas-n8n.ubjifz.easypanel.host/webhook/bd95e5ce-4ebf-48c9-b823-ad8b57429c7e';
  };

  const handleProcessAnalysis = async (data: AnalysisData, files: File[]) => {
    const webhookUrl = getWebhookUrl();
    
    if (!webhookUrl) {
      showError("URL do Webhook não configurada. Verifique as configurações.");
      return;
    }

    setIsProcessing(true);
    const toastId = showLoading('Lendo arquivos e enviando para a IA processar...');

    try {
      // 1. Ler o conteúdo bruto dos arquivos
      const filesContent = await readFilesForWebhook(files);
      
      if (filesContent.length === 0) {
        throw new Error("Falha ao ler o conteúdo dos arquivos.");
      }

      // 2. Montar o payload
      const payload = {
        analysisData: {
          ...data,
          competenceDate: data.competenceDate.toISOString()
        },
        files: filesContent
      };

      // 3. Enviar para o Webhook
      console.log("Enviando payload para:", webhookUrl);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erro no servidor da IA: ${response.status} ${response.statusText}`);
      }

      // 4. Processar Resposta
      const result: AiProcessingResponse = await response.json();
      console.log("Resposta da IA recebida:", result);

      // Validação básica da resposta
      if (!result.transacoesTributaveis && !result.transacoesNaoTributaveis) {
         throw new Error("A resposta da IA não contém as listas de transações esperadas.");
      }

      // Adicionar categoria e garantir formato nas transações retornadas
      const taxable = (result.transacoesTributaveis || []).map((t, i) => ({
        ...t,
        id: t.id || `ai-tax-${i}`,
        category: 'taxable' as const,
        // Garantir que amount seja número
        amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
      }));

      const nonTaxable = (result.transacoesNaoTributaveis || []).map((t, i) => ({
        ...t,
        id: t.id || `ai-nontax-${i}`,
        category: 'non-taxable' as const,
        amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
      }));

      setTransactions([...taxable, ...nonTaxable]);
      setAnalysisData(data);
      setAiAnalysisText(result.analise || "Análise processada com sucesso.");
      
      setStep('result');
      dismissToast(toastId);
      showSuccess("Processamento da IA concluído!");

    } catch (error) {
      console.error("Erro no processo:", error);
      dismissToast(toastId);
      showError(error instanceof Error ? error.message : "Erro desconhecido ao processar com a IA.");
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
    setAiAnalysisText("");
  };

  // Função stub para manter compatibilidade com interface, mas agora o processamento principal JÁ É a IA
  const handleReanalyzeAi = async (type: 'prod' | 'test') => {
     showSuccess("A análise já foi feita pela IA no processamento inicial.");
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      <header className="py-4 px-4 md:px-8 no-print flex justify-between items-center bg-white dark:bg-gray-950 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-indigo-600 dark:text-indigo-400">
          Analisador Financeiro AI
        </h1>
        <SettingsSheet />
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 print-container">
        {step === 'input' && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold mb-1">Novo modo de processamento ativo</p>
              Os extratos serão enviados diretamente para a IA, que identificará automaticamente o formato e classificará as transações. Certifique-se de que a URL do Webhook em <strong>Configurações</strong> (ícone da engrenagem) está correta.
            </div>
            <AnalysisForm onSubmit={handleProcessAnalysis} isProcessing={isProcessing} />
          </div>
        )}
        
        {step === 'result' && analysisData && (
          <div className="space-y-6">
             {/* Exibindo o parecer da IA que veio no JSON */}
            {aiAnalysisText && (
               <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-indigo-100 dark:border-indigo-900 no-print">
                  <h3 className="text-lg font-semibold mb-2 text-indigo-600 dark:text-indigo-400">Parecer da IA</h3>
                  <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                    {aiAnalysisText}
                  </div>
               </div>
            )}

            <AnalysisResult 
              transactions={transactions} 
              analysisData={analysisData}
              onBack={handleNewAnalysis}
              onToggleCategory={handleToggleTransactionCategory}
              onAiAnalysis={handleReanalyzeAi} // Desabilitado visualmente ou informativo
              isAiProcessing={false}
            />
          </div>
        )}
      </main>
      
      <footer className="py-4 no-print border-t mt-auto">
        <MadeWithDyad />
      </footer>
    </div>
  );
};

export default Index;