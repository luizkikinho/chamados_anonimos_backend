/**
 * @param {string} phoneNumber
 * @returns {object}
 */

function buildLgpdPayload(phoneNumber) {
  return {
    number: phoneNumber,
    title: "📋 Antes de continuar, leia os Termos de Uso!",
    description:
      "Para garantir o seu anonimato e cumprir com a LGPD, precisamos que você confirme nossos termos de uso antes de prosseguir.",
    footer: "Nenhum dado pessoal será armazenado!",
    buttons: [
      {
        type: "reply",
        displayText: "✔️ Aceitar",
        id: "btn_aceitar_termos",
      },
      {
        type: "reply",
        displayText: "📄 Ler Termos Completos",
        id: "btn_ler_termos",
      },
    ],
  };
}

function buildMenuPayload(phoneNumber) {
  return {
    number: phoneNumber,
    title: "MENU PRINCIPAL",
    description: "Como podemos ajudar?",
    footer: "Selecione uma opção para continuar.",
    buttons: [
      {
        type: "reply",
        displayText: "➕ Nova Denúncia",
        id: "btn_nova_denuncia",
      },
      {
        type: "reply",
        displayText: "🔎 Consultar Ticket",
        id: "btn_consultar_ticket",
      },
      {
        type: "reply",
        displayText: "❌ Encerrar",
        id: "btn_encerrar"
      }
    ],
  };
}

function buildCategoryListPayload(phoneNumber, categorias) {
  const rows = categorias.map((cat) => ({
    title: cat.nome,
    //  description: `Relatar ocorrência de ${cat.nome.toLowerCase()}`,
    rowId: `cat_${cat.id}`,
  }));

  rows.push({
    title: "❌ Cancelar",
    rowId: "btn_cancelar",
  });

  return {
    number: phoneNumber,
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

function buildConfirmarRelatoPayload(phoneNumber) {
  return {
    number: phoneNumber,
    title: "✅ Confirme se está tudo certo",
    description:
      "Confira se o relato está tudo certo e clique em ```Confirmar``` para salvar sua denúncia.",
    footer: "Ou clique em 'Cancelar' para reescrever seu relato",
    buttons: [
      {
        type: "reply",
        displayText: "✅ Confirmar",
        id: "btn_confirmar_relato",
      },
      {
        type: "reply",
        displayText: "✏️ Reescrever Relato",
        id: "btn_reescrever_relato",
      },
    ],
  };
}

function buildCopyTicketPayload(phoneNumber, protocolo) {
  return {
    number: phoneNumber,
    options: { delay: 1200, presence: "composing" },
    title: "🎟️ Guarde seu ticket!",
    description: `Seu número de protocolo é ${protocolo}. Guarde esse código em um local seguro. Ele será a única forma de consultar o andamento da sua denúncia no futuro`,
    footer: "Canal de Denúncias Seguro",
    buttons: [
      {
        type: "copy",
        displayText: "Copiar Protocolo",
        copyCode: protocolo
      }
    ]
  }
}

function buildPosRelatoButtonsPayload(phoneNumber) {
  return {
    number: phoneNumber,
    options: { delay: 1500, presence: "composing" },
    title: "O que fazer agora?",
    footer: "Canal de Denúncias Seguro",
    buttons: [
      {
        type: "reply",
        displayText: "➕ Nova Denúncia",
        id: "btn_nova_denuncia",
      },
      {
        type: "reply",
        displayText: "🔎 Consultar Ticket",
        id: "btn_consultar_ticket",
      },
      {
        type: "reply",
        displayText: "❌ Encerrar",
        id: "btn_encerrar"
      }
    ]
  }
}

module.exports = {
  buildLgpdPayload,
  buildMenuPayload,
  buildCategoryListPayload,
  buildConfirmarRelatoPayload,
  buildCopyTicketPayload,
  buildPosRelatoButtonsPayload
};
