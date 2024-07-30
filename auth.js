const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
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

        if (error && error.code === 'PGRST116') {
            // Se o erro for "PGRST116" significa que não encontrou o usuário
            return res.status(400).json({ message: `Senha incorreta para ${email} ou email não cadastrado` });
        } else if (error) {
            throw error;
        }

        if (!user) {
            return res.status(400).json({ message: `Senha incorreta para ${email} ou email não cadastrado` });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: `Senha incorreta para ${email}` });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, message: 'Login bem-sucedido!' });
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para solicitar redefinição de senha
router.post('/forgot', async (req, res) => {
    const { email } = req.body;

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(400).json({ message: 'Usuário não encontrado' });
        }

        // Gera um token de redefinição de senha
        const token = crypto.randomBytes(32).toString('hex');

        // Salva o token no banco de dados
        await supabase
            .from('password_resets')
            .insert([{ email, token, created_at: new Date() }]);

        // Configura o transporte de e-mail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        // Configura o e-mail
        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'Redefinição de Senha',
            text: `Você solicitou a redefinição de senha da sua conta. Clique no link para redefinir: ${process.env.FRONTEND_URL}/reset-password.html?token=${token}&email=${email}`,
        };

        // Envia o e-mail
        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('Erro ao enviar e-mail:', err);
                return res.status(500).json({ message: 'Erro ao enviar e-mail!' });
            } else {
                console.log('E-mail enviado:', info.response);
                return res.status(200).json({ message: 'E-mail enviado com sucesso!' });
            }
        });
    } catch (err) {
        console.error('Erro ao solicitar redefinição de senha:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para redefinir a senha
router.post('/reset', async (req, res) => {
    const { email, token, newPassword } = req.body;

    try {
        // Verifica o token
        const { data: resetRequest, error } = await supabase
            .from('password_resets')
            .select('*')
            .eq('email', email)
            .eq('token', token)
            .single();

        if (error || !resetRequest) {
            return res.status(400).json({ message: 'Token inválido ou expirado' });
        }

        // Atualiza a senha do usuário
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('email', email);

        if (updateError) {
            throw updateError;
        }

        // Remove o token após o uso
        await supabase
            .from('password_resets')
            .delete()
            .eq('email', email)
            .eq('token', token);

        res.status(200).json({ message: 'Senha redefinida com sucesso' });
    } catch (err) {
        console.error('Erro ao redefinir senha:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;
