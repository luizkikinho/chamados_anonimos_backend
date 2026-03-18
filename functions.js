const crypto = require("crypto");
const supabase = require("./db");
const botMessages = require("./messages"); // <-- 1. Importando o dicionário
const userStates = {};

async function processWebhook(payload) {
	console.log("Iniciando o orquestramento de nova mensagem...");

	// 1. Extrai os dados
	const data = extractData(payload);
	if (!data) return null;

	// 2. Anonimiza o remetente e salva no banco de dados
	const anonId = anonymizeUser(data.phoneNumber);
	await saveIdentity(anonId, data.phoneNumber);

	// 3. Gerencia o estado da conversa e recebe a CHAVE (ex: "MENU")
	const actionKey = await handleConversation(anonId, data.text);

	// 4. Traduz a chave para o texto final e envia
	if (actionKey && botMessages[actionKey]) {
		const responseText = botMessages[actionKey];
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
		if (!userStates[anonymizedId]) {
			// Se o ID não tem um estado...
			userStates[anonymizedId] = {
				step: 0, // ... inicia como '0'
				categoryId: null, // Não irá ter categoria...
				complaintText: null, // ... e nem texto
			};
		}

		const session = userStates[anonymizedId];

		// ESTADO 0
		if (session.step === 0) {
			session.step = 1; // Avança para o próximo
			return "MENU"; // Avisa o index para enviar a mensagem de menu
		}

		// ESTADO 1
		if (session.step === 1) {
			const option = text.trim();

			if (["1", "2", "3"].includes(option)) {
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
			const categoryId = session.categoryId;
			const success = await createTicket(anonymizedId, categoryId, reportText);

			if (success) {
				delete userStates[anonymizedId];
				return "CHAMADO_ABERTO";
			} else {
				return "ERRO_BANCO";
			}
		}
	} catch (error) {
		console.log("Erro na Máquina de Estados:", error.message);
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
};
