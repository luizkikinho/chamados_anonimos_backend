const supabase = require('./db');

async function testarConexao() {
	console.log('Batendo na porta do Supabase...\n');

	// Tenta buscar algo em uma tabela que ainda não existe
	const { data, error } = await supabase.from('tabela_inexisteste').select('*').limit(1);
	if (error && error.code === '42P01') {
		console.log('Sucesso, conexão válida!')
	} else if (error) {
		console.log('Erro na conexão: ', error.message);
	} else {
		console.log("Sucesso! Conectado.", data);
	}
}

testarConexao();