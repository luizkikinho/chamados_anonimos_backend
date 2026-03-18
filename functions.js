const crypto = require("crypto");
const supabase = require("./db");
const botMessages = require("./messages");
const userStates = {};

async function processWebhook(payload) {
	console.log("[WEBHOOK] Recebendo nova interação...");

	// Extrai os dados básicos
	const data = extractData(payload);
	if (!data) return null;

	const rawPhoneNumber = data.phoneNumber;
	const text = data.text.trim().toLowerCase();

	// 1. Gera o anonId (necessário para identificar o estado do usuário)
	const anonId = anonymizeUser(rawPhoneNumber);

	// 2. Garante a identidade no banco (LGPD/Triagem anônima)
	await saveIdentity(anonId, rawPhoneNumber);

	// 3. Inicializa a sessão se for um novo usuário ou se ele digitar /start (para resetar)
	if (text === "/start" || !userStates[anonId]) {
		userStates[anonId] = {
			step: 0,
			categoryId: null,
			validIDs: [],
			rawPhone: rawPhoneNumber,
		};
	}

	// 4. Gerencia a conversa e recebe o texto ou a chave
	const actionKey = await handleConversation(anonId, data.text);

	// 5. Traduz a chave (se existir no messages.js) ou usa o texto bruto (menu dinâmico)
	const responseText = botMessages[actionKey] || actionKey;

	if (responseText) {
		await sendWhatsappMessage(rawPhoneNumber, responseText);
	}

	return {
		anonId,
		action: actionKey,
		originalText: data.text,
	};
}

function extractData(payload) {
	try {
		const remoteJid =
			payload.data.key.remoteJidAlt || payload.data.key.remoteJid;
		const text =
			payload.data.message?.conversation ||
			payload.data.message?.extendedTextMessage?.text ||
			"";
		const phoneNumber = remoteJid.split("@")[0];

		return {
			phoneNumber: phoneNumber,
			text: text,
		};
	} catch (error) {
		console.log("Erro ao extrair dados: ", error.message);
		return null;
	}
}

function anonymizeUser(phoneNumber) {
	try {
		const salt = "mas_vai_me_soltar_ne_saci";
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
			const categoryData = await getCategories();

			if (categoryData) {
				session.validIDs = categoryData.validIDs;
				session.step = 1;
				return botMessages.WELCOME_HEADER + categoryData.menuText;
			} else {
				return "ERRO_BANCO";
			}
		}

		// ESTADO 1: Validação da Categoria
		if (session.step === 1) {
			const option = text.trim();

			if (session.validIDs.includes(option)) {
				session.categoryId = option;
				session.step = 2;
				return "PEDIR_RELATO";
			} else {
				return "OPCAO_INVALIDA";
			}
		}

		// ESTADO 2: Recebimento do Relato e Gravação
		if (session.step === 2) {
			const reportText = text.trim();
			if (reportText.length < 10) {
				return "RELATO_MUITO_CURTO";
			}

			const success = await createTicket(
				anonymizedId,
				session.categoryId,
				reportText,
			);

			if (success) {
				session.step = 0;
				delete userStates[anonymizedId]; // Limpa a sessão após o envio bem-sucedido
				return "SUCESSO_ENVIO";
			} else {
				return "ERRO_SISTEMA";
			}
		}
	} catch (error) {
		console.log("Erro na Máquina de Estados:", error.message);
		return "ERRO_SISTEMA";
	}
}

async function getCategories() {
	try {
		const { data, error } = await supabase.from("categoria").select("id, nome");
		if (error) throw error;

		const validIDs = data.map((cat) => String(cat.id));
		const formattedCategories = data.map((cat) => `${cat.id} - ${cat.nome}`);

		return {
			menuText: "\n" + formattedCategories.join("\n"),
			validIDs: validIDs,
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

async function saveIdentity(anonId, phoneNumber) {
	try {
		const { error } = await supabase
			.from("identidades")
			.upsert(
				{ remetente_hash: anonId, telefone: phoneNumber },
				{ onConflict: "remetente_hash" },
			);
		if (error) throw error;
		return true;
	} catch (error) {
		console.log("Erro ao salvar identidade:", error.message);
		return false;
	}
}

async function createTicket(anonId, categoryId, text) {
	try {
		const { error } = await supabase.from("chamados").insert([
			{
				remetente_hash: anonId,
				categoria_id: parseInt(categoryId),
				texto: text,
			},
		]);
		if (error) throw error;
		console.log(`[TG] Chamado registrado: ${anonId}`);
		return true;
	} catch (error) {
		console.log("Erro ao criar chamado:", error.message);
		return false;
	}
}

module.exports = { processWebhook, getCategories };
