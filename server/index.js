require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// --- 1. Environment Variable Validation & Logging ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[Server Init] Starting server...');
console.log(`[Server Init] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[Server Init] SUPABASE_URL Present: ${!!supabaseUrl}`);
console.log(`[Server Init] SUPABASE_ANON_KEY Present: ${!!supabaseAnonKey}`);
console.log(`[Server Init] SUPABASE_SERVICE_ROLE_KEY Present: ${!!supabaseServiceRoleKey}`);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('CRITICAL ERROR: SUPABASE_URL or SUPABASE_ANON_KEY is missing.');
    console.error('This will cause the auth middleware to crash.');
}

// Global admin client (for use sparingly, if keys exist)
let adminSupabase = null;
if (supabaseUrl && supabaseServiceRoleKey) {
    try {
        adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        console.log('[Server Init] Admin Supabase client initialized.');
    } catch (e) {
        console.error('[Server Init] Failed to initialize adminSupabase:', e);
    }
}

// --- 2. CORS Configuration ---
const allowedOrigins = [
    'http://localhost:5173',
    'https://gerenciador-despachante-client.vercel.app',
    // Allow any other Vercel preview URLs usually ending in .vercel.app
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Check exact match or subdomains if needed
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        console.warn(`[CORS] Blocked origin: ${origin}`);
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
    credentials: true
}));

app.use(bodyParser.json());

// Request logging
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url} | Origin: ${req.get('origin')}`);
    next();
});

// --- 3. Authentication Middleware ---
const requireAuth = async (req, res, next) => {
    try {
        // Runtime check for env vars to prevent crash "SupabaseKey is required"
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[AuthMiddleware] CRITICAL: Supabase vars missing at runtime.');
            return res.status(500).json({
                error: 'Server Configuration Error',
                message: 'Supabase URL or Anon Key is missing in server environment.'
            });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.warn('[AuthMiddleware] Missing authorization header');
            return res.status(401).json({ error: 'Missing authorization header' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            console.warn('[AuthMiddleware] Missing bearer token');
            return res.status(401).json({ error: 'Missing token' });
        }

        // Create a scoped client for this user
        // This connects to Supabase AS the user, respecting RLS policies
        const scopedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        });

        // Verify the user
        const { data: { user }, error } = await scopedSupabase.auth.getUser();

        if (error || !user) {
            console.error('[AuthMiddleware] Invalid token or user not found:', error?.message);
            return res.status(401).json({ error: 'Invalid or expired token', details: error?.message });
        }

        // Attach user and scoped client to request
        req.user = user;
        req.supabase = scopedSupabase;
        next();

    } catch (err) {
        console.error('[AuthMiddleware] Unexpected error:', err);
        return res.status(500).json({ error: 'Internal Server Error during Authentication' });
    }
};

// Apply middleware to all /api routes
app.use('/api', requireAuth);

// --- 4. Routes ---

// GET /api/services
app.get('/api/services', async (req, res) => {
    try {
        console.log(`[GET /api/services] Fetching for User ID: ${req.user.id}`);
        // Log the user ID to ensure RLS context is correct

        const { data, error } = await req.supabase
            .from('services')
            .select('*')
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('[GET /api/services] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }

        console.log(`[GET /api/services] Success. Count: ${data ? data.length : 0}`);
        res.json({
            "message": "success",
            "data": data
        });
    } catch (err) {
        console.error('[GET /api/services] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// POST /api/services
app.post('/api/services', async (req, res) => {
    try {
        const { date, type, value, plate, model, owner, client, dispatcher } = req.body;

        if (!date || !type || !value || !plate || !model || !owner || !client) {
            return res.status(400).json({ "error": "Missing required fields" });
        }

        if (typeof value !== 'number') {
            return res.status(400).json({ "error": "Value must be a number" });
        }

        const { data, error } = await req.supabase
            .from('services')
            .insert([{ date, type, value, plate, model, owner, client, dispatcher }])
            .select();

        if (error) {
            console.error('[POST /api/services] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data[0],
            "id": data[0].id
        });
    } catch (err) {
        console.error('[POST /api/services] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// PUT /api/services/:id
app.put('/api/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        delete updates.id;

        const { data, error } = await req.supabase
            .from('services')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('[PUT /api/services] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data[0]
        });
    } catch (err) {
        console.error('[PUT /api/services] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// GET /api/clients
app.get('/api/clients', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('clients')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('[GET /api/clients] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data
        });
    } catch (err) {
        console.error('[GET /api/clients] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// POST /api/clients
app.post('/api/clients', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ "error": "Missing name" });
        }

        const { data, error } = await req.supabase
            .from('clients')
            .insert([{ name }])
            .select();

        if (error) {
            console.error('[POST /api/clients] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data[0],
            "id": data[0].id
        });
    } catch (err) {
        console.error('[POST /api/clients] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// DELETE /api/services/:id
app.delete('/api/services/:id', async (req, res) => {
    try {
        const { error } = await req.supabase
            .from('services')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('[DELETE /api/services] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }
        res.json({ "message": "deleted" });
    } catch (err) {
        console.error('[DELETE /api/services] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// DELETE /api/clients/:id
app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { error } = await req.supabase
            .from('clients')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('[DELETE /api/clients] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }
        res.json({ "message": "deleted" });
    } catch (err) {
        console.error('[DELETE /api/clients] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// GET /api/dispatchers
app.get('/api/dispatchers', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('dispatchers')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('[GET /api/dispatchers] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data
        });
    } catch (err) {
        console.error('[GET /api/dispatchers] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// POST /api/dispatchers
app.post('/api/dispatchers', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ "error": "Missing name" });
        }

        const { data, error } = await req.supabase
            .from('dispatchers')
            .insert([{ name }])
            .select();

        if (error) {
            console.error('[POST /api/dispatchers] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data[0],
            "id": data[0].id
        });
    } catch (err) {
        console.error('[POST /api/dispatchers] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// DELETE /api/dispatchers/:id
app.delete('/api/dispatchers/:id', async (req, res) => {
    try {
        const { error } = await req.supabase
            .from('dispatchers')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('[DELETE /api/dispatchers] DB Error:', error);
            return res.status(400).json({ "error": error.message });
        }
        res.json({ "message": "deleted" });
    } catch (err) {
        console.error('[DELETE /api/dispatchers] Server Error:', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Local development server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} `);
    });
}

// Export for Vercel
module.exports = app;
