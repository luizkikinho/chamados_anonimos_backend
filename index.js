const express = require("express");
const { processWebhook } = require("./functions");
const app = express(); // inicializa o servidor

app.use(express.json());

app.post("/webhook", async (req, res) => {
	// LOG DE EMERGÊNCIA: Isso vai mostrar QUALQUER coisa que bater no servidor
	console.log("------------------------------------");
	console.log("📩 NOVA REQUISIÇÃO RECEBIDA!");
	console.log("CORPO DA REQUISIÇÃO:", JSON.stringify(req.body, null, 2));
	console.log("------------------------------------");

	const result = await processWebhook(req.body);
	res.status(200).json(result);
});

const PORT = 3000;
app.listen(PORT, () => {
	console.log(`Servidor de triagem iniciado na porta ${PORT}...\n`);
});
