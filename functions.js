require("dotenv").config();
const crypto = require("crypto");
const supabase = require("./db");
const botMessages = require("./messages");
const {
  buildLgpdPayload,
  buildMenuPayload,
  buildCategoryListPayload,
  buildConfirmarRelatoPayload,
} = require("./utils/messageBuilder");
const { type } = require("os");

const userStates = {};

async function processWebhook(payload) {
  console.log("[WEBHOOK] Recebendo nova interação...");

  // Extrai os dados básicos
  const data = extractData(payload);
  if (!data) return null;

  const rawPhoneNumber = data.phoneNumber;
  const text = data.text.trim().toLowerCase();

  // 1. Gera o anonId (operação barata em memória) para verificar sessão
  const anonId = anonymizeUser(rawPhoneNumber);

  // 2. FILTRO DE ATIVAÇÃO: Só processa se for /start ou se já houver conversa ativa
  const sessionExists = !!userStates[anonId];

  if (text !== "/start" && !sessionExists) {
    console.log(
      `[FILTRO] Mensagem de ${rawPhoneNumber} ignorada: sem '/start' e sem sessão.`,
    );
    return null;
  }

  // 3. Se passou no filtro, garante a identidade no banco e inicializa/reseta a sessão
  await saveIdentity(anonId, rawPhoneNumber);

  if (text === "/start" || !userStates[anonId]) {
    userStates[anonId] = {
      step: 0,
      categoryId: null,
      validIDs: [],
      rawPhone: rawPhoneNumber,
      erros: 0,
    };
  }

  // 4. Gerencia a conversa e recebe o texto ou a chave
  const actionResult = await handleConversation(anonId, data.text);

  const actions = Array.isArray(actionResult) ? actionResult : [actionResult];

  for (const action of actions) {
    if (!action) continue;
    if (action.type === "buttons") {
      const payload = action.payloadBuilder(rawPhoneNumber);
      await sendWhatsappButtons(rawPhoneNumber, payload);
    } else if (action.type === "list") {
      const payload = action.payloadBuilder(rawPhoneNumber);
      await sendWhatsappList(rawPhoneNumber, payload);
    } else if (typeof action === "string") {
      const responseText = botMessages[action] || action;
      if (responseText) {
        await sendWhatsappMessage(rawPhoneNumber, responseText);
      }
    }
  }

  return {
    anonId,
    action: typeof actionResult === "string" ? actionResult : actionResult.type,
    originalText: data.text,
  };
}

function extractData(payload) {
  try {
    if (payload.data.key.fromMe) {
      return null;
    }

    const remoteJid = payload.data.remoteJidAlt || payload.data.key.remoteJid;

    const buttonResponse =
      payload.data.message?.buttonsResponseMessage?.selectedButtonId ||
      payload.data.message?.templateButtonReplyMessage?.selectedId ||
      payload.data.message?.listResponseMessage?.singleSelectReply
        ?.selectedRowId ||
      payload.data.message?.interactiveResponseMessage
        ?.nativeFlowResponseMessage?.name;

    const textResponse =
      payload.data.message?.conversation ||
      payload.data.message?.extendedTextMessage?.text ||
      "";

    const finalInteraction = buttonResponse || textResponse;

    const phoneNumber = remoteJid.split("@")[0];

    return {
      phoneNumber: phoneNumber,
      text: finalInteraction,
    };
  } catch (error) {
    console.log("Erro ao extrair dados: ", error.message);
    return null;
  }
}

function anonymizeUser(phoneNumber) {
  try {
    const salt = process.env.SALT || "salt_emergencia";
    const fullHash = crypto
      .createHmac("sha256", salt)
      .update(phoneNumber)
      .digest("hex");
    return fullHash.substring(0, 8);
  } catch (error) {
    console.log("Erro na anonimização: ", error.message);
    return null;
  }
}

async function handleConversation(anonymizedId, text) {
  try {
    const session = userStates[anonymizedId];

    // ESTADO 0: Envio do Menu Dinâmico
    if (session.step === 0) {
      session.step = "AGUARDANDO_LGPD";
      return [
        "WELCOME_HEADER",
        {
          type: "buttons",
          payloadBuilder: buildLgpdPayload,
        },
      ];
    }

    // ESTADO 1
    if (session.step === "AGUARDANDO_LGPD") {
      if (text === "btn_aceitar_termos") {
        session.step = "MENU_PRINCIPAL";
        return {
          type: "buttons",
          payloadBuilder: buildMenuPayload,
        };
      } else if (text === "btn_ler_termos") {
        return "TERMOS_LGPD_COMPLETOS";
      } else {
        session.erros += 1;
        if (session.erros >= 3) {
          delete userStates[anonymizedId];
          return "LIMITE_ERROS";
        }
        return "POR_FAVOR_USE_OS_BOTOES";
      }
    }

    // ESTADO 2
    if (session.step === "MENU_PRINCIPAL") {
      if (text === "btn_nova_denuncia") {
        const categoryData = await getCategories();
        if (!categoryData) return "ERRO_BANCO";

        session.validIDs = categoryData.validIDs;
        session.step = "SELECIONANDO_CATEGORIA";

        return {
          type: "list",
          payloadBuilder: (numero) =>
            buildCategoryListPayload(numero, categoryData.rawCategories),
        };
      }
    }

    // ESTADO 2.5
    if (session.step === "SELECIONANDO_CATEGORIA") {
      if (text === "btn_cancelar") {
        delete userStates[anonymizedId];
        return "OPERACAO_CANCELADA";
      }

      if (text.startsWith("cat_")) {
        const idEscolhido = text.split("_")[1];
        if (session.validIDs.includes(idEscolhido)) {
          session.categoryId = idEscolhido;
          session.step = "ESCREVENDO_RELATO";
          return "PEDIR_RELATO";
        }
      }
      session.erros += 1;
      if (session.erros >= 3) {
        delete userStates[anonymizedId];
        return "LIMITE_ERROS";
      }
      return "POR_FAVOR_USE_A_LISTA";
    }

    // ESTADO 3
    if (session.step === "ESCREVENDO_RELATO") {
      if (text.length < 10) {
        return "RELATO_MUITO_CURTO";
      }

      session.relatoProvisorio = text;
      session.step = "CONFIRMANDO_RELATO";

      return {
        type: "buttons",
        payloadBuilder: (numero) =>
          buildConfirmarRelatoPayload(numero, session.relatoProvisorio),
      };
    }

    // ESTADO 4
    if (session.step === "CONFIRMANDO_RELATO") {
      if (text === "btn_confirmar_relato") {
        // 1. Gera o Protocolo Amigável (Ex: DEN-8492-A7F1)
        const hashCurto = crypto.randomBytes(2).toString("hex").toUpperCase();
        const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
        const ticketProtocolo = `DEN-${numeroAleatorio}-${hashCurto}`;

        // 2. Tenta salvar no Supabase (Precisamos atualizar a createTicket lá embaixo!)
        const success = await createTicket(
          anonymizedId,
          session.categoryId,
          session.relatoProvisorio,
          ticketProtocolo,
        );

        if (success) {
          // 3. ZERO TRUST: Destruição total da sessão em RAM
          delete userStates[anonymizedId];

          // 4. Retorna a mensagem de sucesso e o protocolo
          return [
            "SUCESSO_ENVIO",
            `Seu número de protocolo é:\n\n*${ticketProtocolo}*\n\nGuarde este código. Ele será a única forma de consultar o andamento da sua denúncia no futuro.`,
          ];
        } else {
          return "ERRO_SISTEMA";
        }
      } else if (text === "btn_reescrever_relato") {
        session.relatoProvisorio = null;
        session.step = "ESCREVENDO_RELATO";
        return "PEDIR_RELATO_NOVAMENTE";
      } else {
        session.erros += 1;
        if (session.erros >= 3) {
          delete userStates[anonymizedId];
          return "LIMITE_ERROS";
        }
        return "POR_FAVOR_USE_OS_BOTOES";
      }
    }
  } catch (error) {
    console.log("Erro na Máquina de Estados:", error.message);
    return "ERRO_SISTEMA";
  }
}

// async function getCategories() {
//   try {
//     const { data, error } = await supabase.from("categoria").select("id, nome");

//     if (error) throw error;

//     const validIDs = data.map((cat) => String(cat.id));
//     const formattedCategories = data.map((cat) => `${cat.id} - ${cat.nome}`);

//     return {
//       rawCategories: data,
//       validIDs: validIDs,
//     };
//   } catch (error) {
//     console.log("Erro ao capturar categorias:", error.message);
//     return null;
//   }
// }

async function getCategories() {
  console.log("[MOCK DB] Usando categorias falsas de teste");
  return {
    rawCategories: [
      { id: 1, nome: "Assédio (Teste)" },
      { id: 2, nome: "Fraude (Teste)" },
    ],
    validIDs: ["1", "2"],
  };
}

async function sendWhatsappMessage(phoneNumber, messageText) {
  try {
    const endpoint = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE_NAME}`;

    const payloadEvolution = {
      number: phoneNumber,
      options: { delay: 1200, presence: "composing" },
      text: messageText,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify(payloadEvolution),
    });

    return response.ok;
  } catch (error) {
    console.log("Erro ao disparar mensagem:", error.message);
    return false;
  }
}

async function sendWhatsappButtons(phoneNumber, payload) {
  try {
    const endpoint = `${process.env.EVOLUTION_API_URL}/message/sendButtons/${process.env.EVOLUTION_INSTANCE_NAME}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(
        `[EVOLUTION API] Falha ao enviar botões: Status ${response.status} - ${errorData}`,
      );
    }
    return response.ok;
  } catch (error) {
    console.error("Erro ao disparar botões:", error.message);
    return false;
  }
}

async function sendWhatsappList(phoneNumber, payload) {
  try {
    const endpoint = `${process.env.EVOLUTION_API_URL}/message/sendList/${process.env.EVOLUTION_INSTANCE_NAME}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(
        `[EVOLUTION API] Falha ao enviar lista: Status ${response.status} - ${errorData}`,
      );
    }
    return response.ok;
  } catch (error) {
    console.error("Erro ao disparar lista:", error.message);
    return false;
  }
}

async function saveIdentity(anonId, phoneNumber) {
  console.log(`[MOCK DB] Fingindo salvar identidade: ${anonId}`);
  return true; // Finge que deu certo
}

async function createTicket(anonId, categoryId, text, ticketProtocolo) {
  console.log(`\n[MOCK DB] 💾 SIMULANDO GRAVAÇÃO DO CHAMADO NO BANCO...`);
  console.log(` ├─ Protocolo Gerado: ${ticketProtocolo}`);
  console.log(` ├─ Hash do Denunciante: ${anonId}`);
  console.log(` ├─ ID da Categoria: ${categoryId}`);
  console.log(` └─ Texto do Relato: "${text}"\n`);

  return true; // Finge para a máquina de estados que deu tudo certo
}

module.exports = { processWebhook, getCategories };
