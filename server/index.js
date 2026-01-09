require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseKey) {
    console.error('CRITICAL ERROR: Missing Supabase environment variables');
    console.error('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
    console.error('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing');
    // We don't exit to allow Vercel to potentially recover if vars are injected late, but warn loudly.
}

// Global admin client (use sparingly)
const adminSupabase = createClient(supabaseUrl, supabaseKey);

// CORS Configuration
const allowedOrigins = [
    'http://localhost:5173',
    'https://gerenciador-despachante-client.vercel.app',
    'https://gerenciador-despachante-client-git-main-jpreis7s-projects.vercel.app' // Add Preview URL if needed
];

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
    credentials: true
}));

app.use(bodyParser.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Authentication Middleware
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.warn('Missing authorization header');
            return res.status(401).json({ error: 'Missing authorization header' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            console.warn('Missing bearer token');
            return res.status(401).json({ error: 'Missing token' });
        }

        // Create a scoped client for this user
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        });

        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            console.error('Auth Error:', error?.message);
            return res.status(401).json({ error: 'Invalid or expired token', details: error?.message });
        }

        req.user = user;
        req.supabase = supabase; // Attach scoped client to request
        next();
    } catch (err) {
        console.error('Unexpected Auth Middleware Error:', err);
        return res.status(500).json({ error: 'Internal Server Error during Authentication' });
    }
};

// Apply middleware to all API routes
app.use('/api', requireAuth);

// Routes
// NOTE: We now use `req.supabase` instead of the global `adminSupabase`

// GET /api/services - Retrieve all services
app.get('/api/services', async (req, res) => {
    try {
        console.log('Fetching services for user:', req.user.id);
        const { data, error } = await req.supabase
            .from('services')
            .select('*')
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Supabase Error (GET /api/services):', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data
        });
    } catch (err) {
        console.error('Server Error (GET /api/services):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// POST /api/services - Create a new service
app.post('/api/services', async (req, res) => {
    try {
        const { date, type, value, plate, model, owner, client, dispatcher } = req.body;

        // Basic validation
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
            console.error('Supabase Error (POST /api/services):', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data[0],
            "id": data[0].id
        });
    } catch (err) {
        console.error('Server Error (POST /api/services):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// PUT /api/services/:id - Update a service
app.put('/api/services/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Prevent updating ID
        delete updates.id;

        const { data, error } = await req.supabase
            .from('services')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Supabase Error (PUT /api/services):', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data[0]
        });
    } catch (err) {
        console.error('Server Error (PUT /api/services):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// GET /api/clients - Retrieve all clients
app.get('/api/clients', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('clients')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Supabase Error (GET /api/clients):', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data
        });
    } catch (err) {
        console.error('Server Error (GET /api/clients):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// POST /api/clients - Create a new client
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
            console.error('Supabase Error (POST /api/clients):', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data[0],
            "id": data[0].id
        });
    } catch (err) {
        console.error('Server Error (POST /api/clients):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// DELETE /api/services/:id - Delete a service
app.delete('/api/services/:id', async (req, res) => {
    try {
        const { error } = await req.supabase
            .from('services')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('Supabase Error (DELETE /api/services):', error);
            return res.status(400).json({ "error": error.message });
        }
        res.json({ "message": "deleted" });
    } catch (err) {
        console.error('Server Error (DELETE /api/services):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// DELETE /api/clients/:id - Delete a client
app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { error } = await req.supabase
            .from('clients')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('Supabase Error (DELETE /api/clients):', error);
            return res.status(400).json({ "error": error.message });
        }
        res.json({ "message": "deleted" });
    } catch (err) {
        console.error('Server Error (DELETE /api/clients):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// GET /api/dispatchers - Retrieve all dispatchers
app.get('/api/dispatchers', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('dispatchers')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Supabase Error (GET /api/dispatchers):', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data
        });
    } catch (err) {
        console.error('Server Error (GET /api/dispatchers):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// POST /api/dispatchers - Create a new dispatcher
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
            console.error('Supabase Error (POST /api/dispatchers):', error);
            return res.status(400).json({ "error": error.message });
        }

        res.json({
            "message": "success",
            "data": data[0],
            "id": data[0].id
        });
    } catch (err) {
        console.error('Server Error (POST /api/dispatchers):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// DELETE /api/dispatchers/:id - Delete a dispatcher
app.delete('/api/dispatchers/:id', async (req, res) => {
    try {
        const { error } = await req.supabase
            .from('dispatchers')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            console.error('Supabase Error (DELETE /api/dispatchers):', error);
            return res.status(400).json({ "error": error.message });
        }
        res.json({ "message": "deleted" });
    } catch (err) {
        console.error('Server Error (DELETE /api/dispatchers):', err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// Local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} `);
    });
}

// Export for Vercel
module.exports = app;
