const { log } = require("console");
const crypto = require("crypto");
const supabase = require("./db");
const userStates = {};

async function processWebhook(payload) {
	console.log("Iniciando o orquestramento de nova mensagem...");

	// 1. Extrai os dados
	const data = extractData(payload);
	if (!data) return null;

	// 2. Anonimiza o remetente e salva no banco de dados
	const anonId = anonymizeUser(data.phoneNumber);
	await saveIdentity(anonId, data.phoneNumber);

	// 3. Gerencia o estado da conversa
	const action = handleConversation(anonId, data.text);

	let responseText = "";
	if (action === "MENU") {
		responseText =
			"Olá! Digite o número da Categoria:\n1- TI\n2- RH\n3- Infraestrutura";
	} else if (action === "PEDIR_RELATO") {
		responseText =
			"Categoria selecionada. Por favor, digite o seu relato detalhado do problema:";
	} else if (action === "CHAMADO_ABERTO") {
		responseText =
			"Seu chamado foi aberto com sucesso e de forma totalmente anônima! Aguarde o retorno.";
	} else {
		return null;
	}

	sendWhatsappMessage(data.phoneNumber, responseText);

	return {
		anonId,
		action,
		originalText: data.text,
	};
}

function extractData(payload) {
	try {
		// Navega pela estrutura do JSON para pegar o ID e o texto.
		// O número de telefone vem como "5512999999999@s.whatsapp.net",
		// então vou remover tudo a partir do '@'.
		const remoteJid = payload.data.key.remoteJid;
		const text = payload.data.message.conversation;
		const phoneNumber = remoteJid.split("@")[0];

		// Retorno no log do terminal
		console.log(`\n\nNúmero de telefone: ${phoneNumber}`);
		console.log(`Mensagem: ${text}`);

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

function sendWhatsappMessage(phoneNumber, messageText) {
	try {
		// Estrutura de chaves
		const payloadEvolution = {
			number: phoneNumber,
			options: {
				delay: 1200,
				presence: "composing", // Mostra que ele está digitando
			},
			textMessage: {
				text: messageText,
			},
		};

		// SIMULAÇÃO DE ENVIO
		// Aqui vai ficar a lógica de envio
		console.log(`\n[EMULADOR DE SAÍDA] Disparando para Evolution API...`);
		console.log(JSON.stringify(payloadEvolution, null, 2));
		console.log(`------------------------------------------------------\n`);

		return true;
	} catch (error) {
		console.log("Erro ao preparar mensagem: ", error.message);
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
