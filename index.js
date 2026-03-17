const express = require("express");
const { processWebhook } = require("./functions");
const app = express(); // inicializa o servidor

app.use(express.json());

app.post("/webhook", async (req, res) => {
	// recebe ('request') o JSON da Evolution
	const result = await processWebhook(req.body);
	if (result) {
		console.log(
			`[LOG TG] Processado ID: ${result.anonId} | Ação: ${result.action}`,
		);
	}

	// Responde 200 para não ficar dando loop de mensagem
	res.status(200).send("OK");
});

const PORT = 3000;
app.listen(PORT, () => {
	console.log(`Servidor de triagem iniciado na porta ${PORT}...\n`);
});
