const crypto = require("crypto");
const supabase = require("./db");
const botMessages = require("./messages");
const userStates = {};

async function processWebhook(payload) {
	console.log("[WEBHOOK] Recebendo nova interação...");

	// Extrai os dados
	const data = extractData(payload);
	if (!data) return null;

	const rawPhoneNumber = data.phoneNumber;
	const text = data.text.trim().toLowerCase();

	const sessionExists = Object.values(userStates).some(
		(s) => s.rawPhone === rawPhoneNumber,
	);

	if (text !== "/start" && !sessionExists) {
		console.log(
			`[IGNORADO] Mensagem de ${rawPhoneNumber} não é '/start' e não há sessão ativa.`,
		);
		return null;
	}

	// Anonimiza o remetente e salva no banco de dados
	const anonId = anonymizeUser(data.phoneNumber);
	await saveIdentity(anonId, data.phoneNumber);

	if (!userStates[anonId]) {
		userStates[anonId] = {
			step: 0,
			categoryId: null,
			complaintText: null,
			rawPhone: rawPhoneNumber,
		};
	}

	// Gerencia o estado da conversa e recebe a CHAVE (ex: "MENU")
	const actionKey = await handleConversation(anonId, data.text);

	// Traduz a chave para o texto final e envia
	const responseText = botMessages[actionKey] || actionKey;

	if (responseText) {
		sendWhatsappMessage(data.phoneNumber, responseText);
	}

	return {
		anonId,
		action: actionKey,
		originalText: data.text,
	};
}

function extractData(payload) {
	try {
		const remoteJid = payload.data.key.remoteJidAlt;
		const text =
			payload.data.message?.conversation ||
			payload.data.message?.extendedTextMessage?.text ||
			".";
		const phoneNumber = remoteJid.split("@")[0];

		console.log(`Número extraído (provável erro): ${phoneNumber}`);

		return {
			phoneNumber: phoneNumber,
			text: text,
		};
	} catch (error) {
		console.log("Erro ao extrair dados: ", error.message);
		return null;
	}
}
// Pseudonimização
function anonymizeUser(phoneNumber) {
	try {
		const salt = "mas_vai_me_soltar_ne_saci";
		const fullHash = crypto
			.createHmac("sha256", salt)
			.update(phoneNumber)
			.digest("hex");
		const shortId = fullHash.substring(0, 8);

		// A ser removido no deploy
		console.log(
			`\n\nNúmero original: ${phoneNumber}, convertido para o ID ${shortId}.`,
		);
		return shortId;
	} catch (error) {
		console.log("Erro: ", error.message);
		return null;
	}
}

// Função para controle de fluxo da conversa (Máquina de Estados)
async function handleConversation(anonymizedId, text) {
	try {
		const session = userStates[anonymizedId];

		// ESTADO 0
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

		// ESTADO 1
		if (session.step === 1) {
			const option = text.trim();

			if (session.validIDs.includes(option)) {
				session.categoryId = option;
				session.step = 2; // Avança para o próximo estado
				return "PEDIR_RELATO";
			} else {
				return "OPCAO_INVALIDA";
			}
		}

		// ESTADO 2
		if (session.step === 2) {
			const reportText = text.trim();
			if (reportText.length < 10) {
				return "RELATO_MUITO_CURTO";
			}

			const success = await createTicket(
				session.anonId,
				session.categoryId,
				reportText,
			);

			if (success) {
				session.step = 0;
				return "SUCESSO_ENVIO";
			} else {
				return "ERRO_SISTEMA";
			}
		}
	} catch (error) {
		console.log("Erro na Máquina de Estados:", error.message);
		return null;
	}
}

async function getCategories() {
	try {
		const { data, error } = await supabase.from("categoria").select("id, nome");

		if (error) {
			console.log("\nErro ao capturar categorias: ", error.message);
			return null;
		}

		const validIDs = data.map((category) => {
			return String(category.id);
		});

		const formattedCategories = data.map((category) => {
			return `${category.id} - ${category.nome}`;
		});

		return {
			menuText: formattedCategories.join("\n"),
			validIDs: validIDs,
		};
	} catch (error) {
		console.log(
			"\nErro no Supabase ao tentar capturar categorias: ",
			error.message,
		);
		return null;
	}
}

async function sendWhatsappMessage(phoneNumber, messageText) {
	try {
		const evolutionUrl = process.env.EVOLUTION_API_URL;
		const instanceName = process.env.EVOLUTION_INSTANCE_NAME;
		const apiKey = process.env.EVOLUTION_API_KEY;

		const endpoint = `${evolutionUrl}/message/sendText/${instanceName}`;

		// 1. Formato simplificado (Padrão mais comum da Evolution)
		const payloadEvolution = {
			number: phoneNumber,
			options: {
				delay: 1200,
				presence: "composing",
			},
			text: messageText, // Movido para fora do bloco textMessage
		};

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: apiKey,
			},
			body: JSON.stringify(payloadEvolution),
		});

		if (!response.ok) {
			const errorDetails = await response.text();
			console.log(`[ERRO OUTBOUND] Status ${response.status}`);
			console.log(`[MOTIVO]: ${errorDetails}`);
			return false;
		}

		console.log(`\n[OUTBOUND] Mensagem enviada com sucesso para o número!`);
		return true;
	} catch (error) {
		console.log("Erro ao disparar mensagem: ", error.message);
		return false;
	}
}

async function saveIdentity(anonId, phoneNumber) {
	try {
		const { error } = await supabase.from("identidades").upsert(
			{
				remetente_hash: anonId,
				telefone: phoneNumber,
			},
			{ onConflict: "remetente_hash" },
		);

		if (error) {
			console.log("Erro do Supabase ao salvar identidade:", error.message);
			return false;
		}

		console.log(`\nIdentidade vincula com sucesso no cofre: ${anonId}`);
		return true;
	} catch (error) {
		console.log("Erro na execução da saveIdentity:", error.message);
		return false;
	}
}

// Formata os dados para a tabela chamados
async function createTicket(anonId, categoryId, text) {
	try {
		const { error } = await supabase.from("chamados").insert([
			{
				remetente_hash: anonId,
				categoria_id: parseInt(categoryId),
				texto: text,
			},
		]);

		if (error) {
			console.log("Erro do Supabase ao criar o chamado:", error.message);
			return false;
		}

		console.log(`\n\n[TG] Chamado registrado com sucesso para o id: ${anonId}`);
		return true;
	} catch (error) {
		console.log('Erro na execução do "createTicket": ', error.message);
		return false;
	}
}

module.exports = {
	processWebhook,
	getCategories,
};
