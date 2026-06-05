require("dotenv").config();
const crypto = require("crypto");
const supabase = require("./db");
const botMessages = require("./messages");
const {
    buildLgpdPayload, buildMenuPayload, buildCategoryListPayload, buildConfirmarRelatoPayload, buildCopyTicketPayload,
} = require("./utils/messageBuilder");

const userStates = {};

async function processWebhook(payload) {
    let empresaId_atual;
    try {
        const data = extractData(payload);
        if (!data) return null;

        const instanceName = payload.instance;
        const rawPhoneNumber = data.phoneNumber;
        const text = data.text.trim().toLowerCase();
        const anonId = anonymizeUser(rawPhoneNumber);

        console.log(`\n======================================================`);
        console.log(`[WEBHOOK] 📩 Nova interação de ${rawPhoneNumber} na instância [${instanceName}]`,);
        console.log(`[EXTRAÇÃO] Comando recebido: ${text}`);

        const sessionExists = !!userStates[anonId];

        if (text !== "/start" && !sessionExists) {
            console.log(`[FILTRO] Mensagem ignorada: sem '/start' e sem sessão.`);
            return null;
        }

        if (sessionExists) {
            empresaId_atual = userStates[anonId].empresaId;
        } else {
            empresaId_atual = await getEmpresa(instanceName);

            if (!empresaId_atual) {
                console.log("[ERRO] Empresa não encontrada ou inativa. Abortando.");
                return null;
            }
        }

        if (text === "/start" || !userStates[anonId]) {
            userStates[anonId] = {
                step: 0, categoryId: null, validIDs: [], rawPhone: rawPhoneNumber, erros: 0, empresaId: empresaId_atual,
            };
        }

        const respostas = await handleConversation(anonId, text);

        if (respostas) {
            const mensagens = Array.isArray(respostas) ? respostas : [respostas];
            for (const msg of mensagens) {
                if (typeof msg === "string") {
                    const textoFinal = botMessages[msg] || msg;
                    await sendWhatsappMessage(rawPhoneNumber, textoFinal);
                } else if (typeof msg === "object") {
                    if (msg.type === "buttons") {
                        await sendWhatsappButtons(rawPhoneNumber, msg.payloadBuilder(rawPhoneNumber),);
                    } else if (msg.type === "list") {
                        await sendWhatsappList(rawPhoneNumber, msg.payloadBuilder(rawPhoneNumber),);
                    }
                }
            }
        }
    } catch (error) {
        console.error("[ERRO GRAVE NO WEBHOOK]:", error);
    }
}

function extractData(payload) {
    try {
        if (payload.data.key.fromMe) {
            return null;
        }

        const remoteJid = payload.data.remoteJidAlt || payload.data.key.remoteJid;

        let interactiveBtnId = null;
        try {
            const paramsJson = payload.data.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
            if (paramsJson) {
                interactiveBtnId = JSON.parse(paramsJson).id;
            }
        } catch (e) {
            console.log("Erro ao tentar ler o paramsJson: ", e.message);
        }

        const buttonResponse = payload.data.message?.buttonsResponseMessage?.selectedButtonId || payload.data.message?.templateButtonReplyMessage?.selectedId || payload.data.message?.listResponseMessage?.singleSelectReply?.selectedRowId || interactiveBtnId;

        const textResponse = payload.data.message?.conversation || payload.data.message?.extendedTextMessage?.text || "";

        const finalInteraction = buttonResponse || textResponse;
        const phoneNumber = remoteJid.split("@")[0];

        console.log(`[EXTRAÇÃO] Comando recebido de ${phoneNumber}: ${finalInteraction}`,);

        return {
            phoneNumber: phoneNumber, text: finalInteraction,
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
            return ["WELCOME_HEADER", {
                type: "buttons", payloadBuilder: buildLgpdPayload,
            },];
        }

        // ESTADO 1
        if (session.step === "AGUARDANDO_LGPD") {
            if (text === "btn_aceitar_termos") {
                session.step = "MENU_PRINCIPAL";
                return {
                    type: "buttons", payloadBuilder: buildMenuPayload,
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
                const categoryData = await getCategories(session.empresaId);
                if (!categoryData) return "ERRO_BANCO";

                session.validIDs = categoryData.validIDs;
                session.step = "SELECIONANDO_CATEGORIA";

                return {
                    type: "list",
                    payloadBuilder: (numero) => buildCategoryListPayload(numero, categoryData.rawCategories),
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
                payloadBuilder: (numero) => buildConfirmarRelatoPayload(numero, session.relatoProvisorio),
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
                const success = await createTicket(session.empresaId, session.categoryId, session.relatoProvisorio, ticketProtocolo,);

                if (success) {
                    // 3. ZERO TRUST: Destruição total da sessão em RAM
                    delete userStates[anonymizedId];

                    // 4. Retorna a mensagem de sucesso e o protocolo
                    return {
                        type: "buttons", payloadBuilder: (numero) => buildCopyTicketPayload(numero, ticketProtocolo),
                    }
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

async function getCategories(empresaId) {
    try {
        const {data, error} = await supabase
            .from("categorias")
            .select("id, name")
            .eq("empresa_id", empresaId)
            .eq("active", true);

        if (error) {
            console.error(error);
            return null
        }

        const validIDs = data.map((cat) => String(cat.id));

        const rawCategories = data.map((cat) => ({
            id: cat.id, nome: cat.name,
        }));

        return {
            rawCategories: rawCategories, validIDs: validIDs,
        };
    } catch (error) {
        console.log("Erro ao capturar categorias:", error.message);
        return null;
    }
}

async function sendWhatsappMessage(phoneNumber, messageText) {
    try {
        const endpoint = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE_NAME}`;

        const payloadEvolution = {
            number: phoneNumber, options: {delay: 1200, presence: "composing"}, text: messageText,
        };

        const response = await fetch(endpoint, {
            method: "POST", headers: {
                "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY,
            }, body: JSON.stringify(payloadEvolution),
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
            method: "POST", headers: {
                "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY,
            }, body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`[EVOLUTION API] Falha ao enviar botões: Status ${response.status} - ${errorData}`,);
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
            method: "POST", headers: {
                "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY,
            }, body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`[EVOLUTION API] Falha ao enviar lista: Status ${response.status} - ${errorData}`,);
        }
        return response.ok;
    } catch (error) {
        console.error("Erro ao disparar lista:", error.message);
        return false;
    }
}

async function createTicket(empresaId, categoryId, text, ticketProtocolo) {
    try {
        console.log(`[DB] Gravando chamado ${ticketProtocolo}.`);

        const {data: chamado, error: supabaseError1} = await supabase
            .from("chamados")
            .insert([{
                empresa_id: empresaId, categoria_id: categoryId, texto: text, protocol: ticketProtocolo, status: "NOVO"
            }])
            .select("id")
            .single();

        if (supabaseError1) {
            console.error("[ERRO SUPABASE - CHAMADOS] ", supabaseError1);
            return false;
        }

        const {error: supabaseError2} = await supabase
            .from("registro_chamados")
            .insert([{
                id_chamado: chamado.id, texto: "Denúncia registrada via Whatsapp", tipo_acao: "ABERTURA_SISTEMA",
            }]);

        if (supabaseError2) {
            console.error("[ERRO SUPABASE - REGISTROS] ", supabaseError2);
            return false;
        }

        console.log(`[SUCESSO] Chamado gravado e histórico gerado.`);
        return true;
    } catch (error) {
        console.error("Erro inesperado no createTicket:", error.message);
        return false;
    }
}

async function getEmpresa(instanceName) {
    try {
        const {data, error} = await supabase
            .from("empresas")
            .select("id, status")
            .eq("instance_name", instanceName)
            .single();
        if (error) {
            console.error(error.message);
            return null;
        }

        if (!data) {
            console.log(`[ROTEAMENTO] Nenhuma empresa encontrada para a instância: ${instanceName}`,);
            return null;
        }

        if (data.status === false) {
            console.log(`[ROTEAMENTO] Instância ${instanceName} pertence a uma empresa inativa.`,);
            return null;
        }

        return data.id;
    } catch (error) {
        console.log("Erro ao buscar empresa: ", error.message);
        return null;
    }
}

module.exports = {processWebhook};
