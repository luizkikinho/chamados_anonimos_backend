const botMessages = {
    WELCOME_HEADER:
        "🛡️ *Bem-vindo ao Canal de Denúncias Seguro*\n\nEste é um ambiente confidencial e protegido. Antes de iniciarmos, precisamos do seu consentimento sobre como tratamos seus dados, de acordo com a LGPD.",

    TERMOS_LGPD_COMPLETOS:
        "📄 *Termos de Privacidade (LGPD)*\n\nGarantimos o absoluto sigilo e anonimato de todas as informações compartilhadas aqui. Seu número de telefone não será exposto aos investigadores.\n\n👇 Por favor, utilize os botões abaixo para confirmar sua leitura e aceitar os termos.",

    OPERACAO_CANCELADA:
        "🚫 *Operação Cancelada*\n\nO processo foi interrompido e nenhuma informação sua foi gravada. Sua privacidade está mantida. Se precisar relatar algo no futuro, basta mandar um *Oi*.",

    PEDIR_RELATO:
        "✍️ *Descreva a situação*\n\nPor favor, digite o seu relato na mensagem abaixo. Para nos ajudar na investigação, tente detalhar o máximo possível:\n\n• O que aconteceu?\n• Quando e onde ocorreu?\n• Quem são os envolvidos?\n\n_Fique tranquilo(a), seu anonimato é garantido._",

    RELATO_MUITO_CURTO:
        "⚠️ *Relato muito curto*\n\nPara que possamos abrir uma investigação adequada, precisamos de um pouco mais de contexto. Por favor, reescreva seu relato adicionando mais detalhes importantes.",

    PEDIR_RELATO_NOVAMENTE:
        "🔄 *Reescrevendo...*\n\nEntendido. O seu rascunho anterior foi apagado da nossa memória. Pode digitar o seu novo relato detalhado logo abaixo:",

    PEDIR_PROTOCOLO_CONSULTA:
        "🔎 *Consultar Protocolo*\n\nPor favor, digite o número do protocolo que você recebeu no momento da denúncia (exemplo: *DEN-1234-ABCD*).",

    MENSAGEM_DESPEDIDA:
        "🔒 *Atendimento Encerrado*\n\nAgradecemos a sua confiança e a coragem em utilizar nosso Canal Seguro. \n\nSua sessão foi encerrada e todos os dados de navegação foram apagados do nosso sistema para a sua segurança. Até logo!",

    POR_FAVOR_USE_OS_BOTOES:
        "👇 Por favor, interaja clicando nos *botões* da mensagem acima para que possamos continuar.",
  
    POR_FAVOR_USE_A_LISTA:
        "📋 Por favor, selecione uma opção clicando no *menu* acima em vez de digitar.",

    LIMITE_ERROS:
        "🔒 *Sessão Encerrada por Segurança*\n\nComo não recebemos a resposta no formato esperado, encerramos este atendimento automaticamente para proteger sua navegação. Para recomeçar, basta enviar uma nova mensagem.",

    ERRO_BANCO:
        "🚨 *Erro de Comunicação*\n\nTivemos um pequeno problema temporário ao carregar as informações. Nenhuma informação sua foi exposta. Por favor, aguarde alguns instantes e envie a mensagem novamente.",

    ERRO_SISTEMA:
        "🚨 *Falha Técnica*\n\nHouve um problema no sistema ao processar sua solicitação. Fique tranquilo(a), seus dados continuam seguros. Por favor, tente novamente mais tarde."
};

module.exports = botMessages;
