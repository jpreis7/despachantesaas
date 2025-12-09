require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3001;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env');
    // We don't exit here to allow the user to add the file and restart, 
    // but operations will fail.
}

const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors({
    origin: ['http://localhost:5173', 'https://gerenciador-despachante-client.vercel.app'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Authentication Middleware
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
};

// Apply middleware to all API routes
app.use('/api', requireAuth);

// Routes

// GET /api/services - Retrieve all services
app.get('/api/services', async (req, res) => {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('date', { ascending: false })
        .order('id', { ascending: false });

    if (error) {
        return res.status(400).json({ "error": error.message });
    }

    res.json({
        "message": "success",
        "data": data
    });
});

// POST /api/services - Create a new service
app.post('/api/services', async (req, res) => {
    const { date, type, value, plate, model, owner, client } = req.body;

    // Basic validation
    if (!date || !type || !value || !plate || !model || !owner || !client) {
        res.status(400).json({ "error": "Missing required fields" });
        return;
    }

    if (typeof value !== 'number') {
        res.status(400).json({ "error": "Value must be a number" });
        return;
    }

    const { data, error } = await supabase
        .from('services')
        .insert([{ date, type, value, plate, model, owner, client }])
        .select();

    if (error) {
        res.status(400).json({ "error": error.message });
        return;
    }

    res.json({
        "message": "success",
        "data": data[0],
        "id": data[0].id
    });
});

// GET /api/clients - Retrieve all clients
app.get('/api/clients', async (req, res) => {
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        res.status(400).json({ "error": error.message });
        return;
    }

    res.json({
        "message": "success",
        "data": data
    });
});

// POST /api/clients - Create a new client
app.post('/api/clients', async (req, res) => {
    const { name } = req.body;

    if (!name) {
        res.status(400).json({ "error": "Missing name" });
        return;
    }

    const { data, error } = await supabase
        .from('clients')
        .insert([{ name }])
        .select();

    if (error) {
        res.status(400).json({ "error": error.message });
        return;
    }

    res.json({
        "message": "success",
        "data": data[0],
        "id": data[0].id
    });
});

// DELETE /api/services/:id - Delete a service
app.delete('/api/services/:id', async (req, res) => {
    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', req.params.id);

    if (error) {
        res.status(400).json({ "error": error.message });
        return;
    }
    res.json({ "message": "deleted" });
});

// DELETE /api/clients/:id - Delete a client
app.delete('/api/clients/:id', async (req, res) => {
    const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', req.params.id);

    if (error) {
        res.status(400).json({ "error": error.message });
        return;
    }
    res.json({ "message": "deleted" });
});

// Local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} `);
    });
}

// Export for Vercel
module.exports = app;
