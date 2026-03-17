require('dotenv').config();

// Apenas iremos utilizar a função 'createClient' do SDK do Supabase,
// demarcado pelos colchetes {}
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey); // A conexão é criada

module.exports = supabase; // Exporta a conexão para usar em outro lugar