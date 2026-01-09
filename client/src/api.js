import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const authenticatedFetch = async (endpoint, options = {}) => {
    // 1. Logs de Debug (Temporário)
    console.group('AuthenticatedFetch Debug');

    // 2. Fetch Session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        console.error('Erro ao recuperar sessão:', sessionError);
    }

    const token = session?.access_token;

    if (token) {
        console.log('✅ Token encontrado:', token.substring(0, 15) + '...');
    } else {
        console.warn('⚠️ NENHUM TOKEN ENCONTRADO. Usuário pode não estar logado ou sessão expirou.');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Ensure endpoint starts with / if not provided
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_URL}${cleanEndpoint}`;

    console.log(`📡 Fetching URL: ${url}`);
    console.groupEnd();

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        // Log response status for visibility
        console.log(`Received response from ${url}: Status ${response.status}`);

        if (response.status === 401) {
            console.warn('Retorno 401 (Unauthorized). Token pode ser inválido ou expirado.');
        }

        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
};
