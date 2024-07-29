const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Endpoint para registro
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: existingUser, error: existingUserError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (existingUserError && existingUserError.code !== 'PGRST116') {
            throw existingUserError;
        }

        if (existingUser) {
            return res.status(400).json({ message: 'Usuário já existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const { data, error } = await supabase
            .from('users')
            .insert([{ email, password: hashedPassword }]);

        if (error) {
            throw error;
        }

        res.status(201).json({ message: 'Conta criada com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar o usuário:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            throw error;
        }

        if (!user) {
            return res.status(400).json({ message: 'Email ou senha incorretos' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Email ou senha incorretos' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, message: 'Login bem-sucedido!' });
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;
