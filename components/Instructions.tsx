
import React from 'react';

const Instructions: React.FC = () => {
  const steps = [
    {
      title: "Sincronização (Ajustes)",
      description: "Na aba Ajustes, sincronize o mês que você deseja preencher, para subir os centros de custo (operações) liberados.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
      )
    },
    {
      title: "Lançar Despesas",
      description: "Preencher as despesas com data, valor, categoria, operação e cidade e salvar. Utilize a câmera ou upload para anexar comprovantes.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      )
    },
    {
      title: "Lançar Combustível",
      description: "Preencher as despesas de combustível e salvar. Lembre-se que o valor é calculado baseado na distância e consumo.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      )
    },
    {
      title: "Pedágio e Estacionamento",
      description: "Caso utilize Tag para pedágio ou estacionamento, pode subir o arquivo PDF ou CSV do extrato na aba Pedágio. Confirme a importação e depois classifique cada despesa com a operação correta ou exclua o item caso não seja relativo a despesas operacionais.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
      )
    },
    {
      title: "Conferência",
      description: "Confira o extrato de lançamentos e o relatório e comprovantes. Verifique se os totais estão corretos antes de enviar.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
      )
    },
    {
      title: "Limpeza e Finalização",
      description: "Depois de tudo conferido e enviado (planilha Excel e ZIP baixados), vá na aba Ajustes e limpe todos os dados para fazer o preenchimento do mês seguinte.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      )
    }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center mb-2">
           <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           Instruções de Uso
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Siga o roteiro abaixo para garantir o correto preenchimento e reembolso de suas despesas.
        </p>
      </div>

      <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4 space-y-8">
        {steps.map((step, index) => (
          <div key={index} className="ml-6 relative group">
            <span className="absolute -left-10 flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full ring-4 ring-white dark:ring-black text-blue-600 dark:text-blue-300">
               {step.icon}
            </span>
            <div className="bg-white dark:bg-gray-900 p-5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow">
              <h3 className="flex items-center mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                <span className="text-sm mr-2 text-gray-400 font-mono">{(index + 1).toString().padStart(2, '0')}</span>
                {step.title}
              </h3>
              <p className="mb-2 text-base font-normal text-gray-500 dark:text-gray-400">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Instructions;
