/**
 * @param {string} numeroDestino
 * @returns {object}
 */

function buildLgpdPayload(numeroDestino) {
  return {
    number: numeroDestino,
    title: "📋 Antes de continuar, leia os Termos de Uso!",
    description:
      "Para garantir o seu anonimato e cumprir com a LGPD, precisamos que você confirme nossos termos de uso antes de prosseguir.",
    footer: "Nenhum dado pessoal será armazenado!",
    buttons: [
      {
        type: "reply",
        displayText: "Aceitar",
        id: "btn_aceitar_termos",
      },
      {
        type: "reply",
        displayText: "Ler Termos Completos",
        id: "btn_ler_termos",
      },
    ],
  };
}

function buildMenuPayload(numeroDestino) {
  return {
    number: numeroDestino,
    title: "MENU PRINCIPAL",
    description: "Como podemos ajudar?",
    footer: "Selecione uma opção para continuar.",
    buttons: [
      {
        type: "reply",
        displayText: "Consultar Ticket",
        id: "btn_consultar_ticket",
      },
      {
        type: "reply",
        displayText: "Nova Denúncia",
        id: "btn_nova_denuncia",
      },
    ],
  };
}

function buildCategoryListPayload(numeroDestino, categorias) {
  const rows = categorias.map((cat) => ({
    title: cat.nome,
    description: `Relatar ocorrência de ${cat.nome.toLowerCase()}`,
    rowId: `cat_${cat.id}`,
  }));

  rows.push({
    title: "❌ Cancelar",
    description: "Encerrar e limpar sessão",
    rowId: "btn_cancelar",
  });

  return {
    number: numeroDestino,
    title: "📂 Categorias de Denúncia",
    description:
      "Por favor, selecione o tema que melhor descreve o seu relato.",
    buttonText: "Ver Categorias",
    footerText: "Seu anonimato é garantido.",
    sections: [
      {
        title: "Opções Disponíveis",
        rows: rows,
      },
    ],
  };
}

function buildConfirmarRelatoPayload(numeroDestino) {
  return {
    number: numeroDestino,
    title: "✅ Confirme se está tudo certo",
    description:
      "Confira se o relato está tudo certo e clique em ```Confirmar``` para salvar sua denúncia.",
    footer: "Ou clique em 'Cancelar' para reescrever seu relato",
    buttons: [
      {
        type: "reply",
        displayText: "Confirmar Denúncia",
        id: "btn_confirmar_relato",
      },
      {
        type: "reply",
        displayText: "Reescrever Relato",
        id: "btn_reescrever_relato",
      },
    ],
  };
}

module.exports = {
  buildLgpdPayload,
  buildMenuPayload,
  buildCategoryListPayload,
  buildConfirmarRelatoPayload,
};
