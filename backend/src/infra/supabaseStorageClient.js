const { createClient } = require('@supabase/supabase-js');

let supabase;

async function getSupabaseClient() {
    if (!supabase) {
        console.log("Criando cliente Supabase");
        supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    }
    return supabase;
}

async function uploadPublicFile({ bucket, path, file }) {
    if (!bucket || !path) throw new Error('bucket e path são obrigatórios');
    if (!file || !file.buffer) throw new Error('file.buffer é obrigatório');

    const supabase = await getSupabaseClient();
    const normalizedPath = String(path).replace(/^\/+/, '').replace(/\\/g, '/');

    // Upload do arquivo
    const { data, error } = await supabase
        .storage
        .from(bucket)
        .upload(normalizedPath, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: true // sobrescreve se já existir
        });

    if (error) throw error;

    // Gera URL pública
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    console.log(`publicData: ${JSON.stringify(publicData)}`);

    return {
        path: data.path,
        publicUrl: publicData.publicUrl
    };
}

async function deletePublicFile({ bucket, path }) {
    if (!bucket || !path) throw new Error('bucket e path são obrigatórios');

    const supabase = await getSupabaseClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) throw error;
    return true;
}

async function uploadToSupabase({ bucket, path, file }) {
    if (!bucket || !path) throw new Error('bucket e path são obrigatórios');
    if (!file || !file.buffer) throw new Error('file.buffer é obrigatório');

    const supabase = await getSupabaseClient();

    const normalizedPath = String(path).replace(/^\/+/, '').replace(/\\/g, '/');

    const { data, error } = await supabase
        .storage
        .from(bucket)                 // APENAS o nome do bucket (ex.: 'AEGEA')
        .upload(normalizedPath, file.buffer, {
            contentType: file.mimetype || 'application/octet-stream',
            upsert: false
        });

    if (error) throw error;
    return data.path; // caminho dentro do bucket
}

async function signedUrl(bucket, path, expires = 3600, transform) {
    const opts = transform ? { transform } : undefined;
    const supabase = await getSupabaseClient();

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires, opts);
    if (error) {
        console.error(error);
        return null;
    }
    return data.signedUrl;
};

module.exports = {
    getSupabaseClient,
    uploadToSupabase,
    signedUrl,
    uploadPublicFile,
    deletePublicFile
}