import { Invoice } from "@/types";

export const parseInvoices = async (files: File[]): Promise<{ invoices: Invoice[], totalAmount: number }> => {
  const invoices: Invoice[] = [];
  let totalAmount = 0;

  for (const file of files) {
    try {
      const content = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, "application/xml");

      const errorNode = xmlDoc.querySelector("parsererror");
      if (errorNode) {
        throw new Error(`Erro ao analisar o XML do arquivo ${file.name}`);
      }

      const dhEmiElement = xmlDoc.querySelector("dhEmi");
      const vNFElement = xmlDoc.querySelector("vNF");

      if (!dhEmiElement || !vNFElement) {
        console.warn(`Tags obrigatórias não encontradas no arquivo ${file.name}. Pulando.`);
        continue;
      }

      const dateStr = dhEmiElement.textContent?.split('T')[0];
      if (!dateStr) {
        console.warn(`Data de emissão inválida no arquivo ${file.name}. Pulando.`);
        continue;
      }
      
      const [year, month, day] = dateStr.split('-');
      const formattedDate = `${day}/${month}/${year}`;
      
      const amount = parseFloat(vNFElement.textContent || '0');

      invoices.push({
        fileName: file.name,
        date: formattedDate,
        amount,
      });

      totalAmount += amount;

    } catch (error) {
      console.error(`Falha ao processar o arquivo de nota fiscal ${file.name}:`, error);
      // Opcional: notificar o usuário sobre o erro específico do arquivo
    }
  }

  return { invoices, totalAmount };
};
