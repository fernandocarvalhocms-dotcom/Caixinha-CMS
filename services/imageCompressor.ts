
/**
 * Serviço dedicado a tratamento de imagens para upload Mobile
 * Garante que a imagem seja leve (max 1024px), sem metadados corrompidos
 * e no formato correto (JPEG) para a API do Gemini.
 */

export const processImageForAI = (file: File): Promise<{ base64: string, previewUrl: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error("Não foi possível criar contexto de imagem"));
                    return;
                }

                // Configurações de Redimensionamento Agressivo
                // 1024px é o "Sweet Spot" para OCR (Leitura de texto)
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                
                let width = img.width;
                let height = img.height;

                // Manter proporção
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = Math.floor(width);
                canvas.height = Math.floor(height);

                // Fundo Branco (previne fundo preto em PNGs transparentes)
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Desenhar imagem redimensionada
                ctx.drawImage(img, 0, 0, width, height);

                // Converter para JPEG com qualidade 0.7 (70%)
                // Isso remove metadados EXIF que costumam quebrar uploads mobile
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                
                // Extrair apenas o Base64 limpo (sem "data:image/jpeg;base64,")
                const cleanBase64 = dataUrl.split(',')[1];

                resolve({
                    base64: cleanBase64,
                    previewUrl: dataUrl
                });
            };

            img.onerror = (err) => reject(new Error("Arquivo de imagem inválido ou corrompido."));
            img.src = event.target?.result as string;
        };

        reader.onerror = (err) => reject(new Error("Erro ao ler arquivo."));
        reader.readAsDataURL(file);
    });
};
