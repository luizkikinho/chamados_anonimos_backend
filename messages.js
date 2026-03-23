const botMessages = {
  // Apenas o cabeçalho, pois a lista virá do banco
  WELCOME_HEADER:
    "Olá! 🛡️ Bem-vindo ao SafeVoice.\nPara iniciar seu relato anônimo, escolha uma categoria respondendo com o número:\n 0 - Cancelar chamado",

  // Mensagem genérica para erro de digitação
  OPCAO_INVALIDA:
    "Ops, não reconheci essa opção. 😕\n\nPor favor, responda apenas com o número correspondente à categoria que você deseja relatar.",

  PEDIR_RELATO:
    "Entendido! ✍️ Agora, por favor, digite o seu relato detalhado. Lembrando que sua identidade está 100% protegida pelo nosso cofre criptográfico.",

  RELATO_MUITO_CURTO:
    "O seu relato é muito importante para nós. 🛡️\n\nPor favor, forneça um pouco mais de detalhes (pelo menos 10 caracteres) para que possamos entender melhor a situação.",

  // Ajustado para coincidir com o "SUCESSO_ENVIO" que você colocou no código
  SUCESSO_ENVIO:
    "✅ Seu chamado foi registrado com sucesso e já está disponível anonimamente para a equipe responsável. Obrigado por utilizar nosso canal seguro!",

  CANCELADO:
    "Entendido! Operação cancelada. Se precisar voltar a este menu, é só me chamar!",

  ERRO_BANCO:
    "❌ Tivemos um problema interno ao acessar as categorias. Por favor, tente novamente mais tarde.",

  ERRO_SISTEMA:
    "❌ Tivemos um erro técnico ao salvar seu chamado. Nossa equipe já foi notificada.",
};

module.exports = botMessages;
