export interface FileContent {
  fileName: string;
  content: string;
}

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          return reject(new Error("Não foi possível ler o buffer do arquivo."));
        }
        const view = new Uint8Array(buffer);
        let content: string;

        // 1. Detecção UTF-16 LE (BOM) - Comum no Banco da Amazônia
        if (view.length >= 2 && view[0] === 0xFF && view[1] === 0xFE) {
          console.log(`[readFileAsText] Detectado BOM UTF-16 LE para ${file.name}`);
          content = new TextDecoder('utf-16le').decode(buffer);
        } 
        // 2. Detecção UTF-8 (BOM)
        else if (view.length >= 3 && view[0] === 0xEF && view[1] === 0xBB && view[2] === 0xBF) {
          console.log(`[readFileAsText] Detectado BOM UTF-8 para ${file.name}`);
          content = new TextDecoder('utf-8').decode(buffer);
        } 
        // 3. Fallback inteligente
        else {
          let decodedAsUtf8 = new TextDecoder('utf-8').decode(buffer);
          // Se tiver caracteres de substituição (), provavelmete é ANSI/Windows-1252 (Bancos BR antigos)
          if (decodedAsUtf8.includes('\uFFFD')) {
            console.log(`[readFileAsText] UTF-8 falhou, usando windows-1252 para ${file.name}`);
            content = new TextDecoder('windows-1252').decode(buffer);
          } else {
            console.log(`[readFileAsText] Usando UTF-8 para ${file.name}`);
            content = decodedAsUtf8;
          }
        }

        // Remove BOM se sobrar no início
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.substring(1);
        }
        
        resolve(content);
      } catch (error) {
        console.error("Erro ao decodificar o arquivo:", error);
        reject(error);
      }
    };
    reader.onerror = (e) => {
      console.error("Erro ao ler o arquivo:", e);
      reject(e);
    };
    reader.readAsArrayBuffer(file);
  });
};

export const readFilesForWebhook = async (files: File[]): Promise<FileContent[]> => {
  const results: FileContent[] = [];
  
  for (const file of files) {
    try {
      const content = await readFileAsText(file);
      results.push({
        fileName: file.name,
        content: content
      });
    } catch (error) {
      console.error(`Erro ao ler arquivo ${file.name}`, error);
    }
  }

  return results;
};