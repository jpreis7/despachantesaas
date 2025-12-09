import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const authenticatedFetch = async (endpoint, options = {}) => {
    const { data: { session } } = await supabase.auth.getSession();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // Ensure endpoint starts with / if not provided
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_URL}${cleanEndpoint}`;

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Optional: handle unauthorized globally (e.g. redirect to login)
        // For now we just allow the component to handle error
        console.warn('Unauthorized request');
    }

    return response;
};
