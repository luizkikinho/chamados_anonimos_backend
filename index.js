const express = require("express");
const { processWebhook } = require("./functions");
const app = express(); // inicializa o servidor

app.use(express.json());

app.post("/webhook", async (req, res) => {
	const result = await processWebhook(req.body);
	res.status(200).json(result);
});

const PORT = 8000;
app.listen(PORT, () => {
	console.log(`Servidor de triagem iniciado na porta ${PORT}...\n`);
});
