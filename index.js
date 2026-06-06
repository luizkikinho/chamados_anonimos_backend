const express = require("express");
const { processWebhook } = require("./functions");
const { exec } = require("child_process");
const app = express();

app.use(express.json());

app.post("/webhook", async (req, res) => {
  const result = await processWebhook(req.body);
  res.status(200).json(result);
});

app.post("/ping", (req, res) => {
  console.log("[KEEP-ALIVE] Recebido o ping de rotina.");
  res.status(200).send("pong");
});

app.post("/deploy-hook", (req, res) => {
  console.log("[DEPLOY] Recebido sinal do Github. Baixando atualizações...");
  res.status(200).send("Deploy iniciado");
  exec(
    "git pull origin main && pm2 restart whatsapp-bot",
    (error, stdout, stderr) => {
      if (err) {
        console.error(`[DEPLOY ERRO] ${err}`);
        return res.status(500).send("Error occured.");
      }
      console.log(`[DEPLOY SUCESSO] Sistema atualizado e reiniciado!`);
      if (stdout) console.log(`[OUTPUT] ${stdout}`);
    },
  );
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Servidor de triagem iniciado na porta ${PORT}...\n`);
});
