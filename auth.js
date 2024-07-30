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

// Configura o transporte de e-mail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
    },
});

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

        const token = crypto.randomBytes(32).toString('hex');

        await supabase
            .from('password_resets')
            .insert([{ email, token, created_at: new Date() }]);

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'Redefinição de Senha',
            text: `Você solicitou a redefinição de senha da sua conta. Clique no link para redefinir: ${process.env.FRONTEND_URL}/reset.html?token=${token}&email=${email}`,
        };

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

//Endpoint para resetar a senha
router.post('/reset', async (req, res) => {
    const { email, token, newPassword } = req.body;

    console.log('Requisição recebida para redefinir senha');
    console.log('Email:', email);
    console.log('Token:', token);

    try {
        // Verificar se o email e o token foram recebidos corretamente
        if (!email || !token || !newPassword) {
            console.log('Dados incompletos na requisição');
            return res.status(400).json({ message: 'Dados incompletos na requisição' });
        }

        // Consulta ao banco de dados para encontrar o registro de redefinição de senha mais recente
        const { data: resetRequests, error: resetError } = await supabase
            .from('password_resets')
            .select('*')
            .eq('email', email)
            .order('created_at', { ascending: false })  // Ordena para obter o mais recente
            .limit(1);

        if (resetError) {
            console.error('Erro na consulta de redefinição de senha:', resetError);
            return res.status(500).json({ message: 'Erro ao consultar o banco de dados' });
        }

        if (resetRequests.length === 0) {
            console.log('Usuário não encontrado ou token inválido');
            return res.status(400).json({ message: 'Usuário não encontrado ou token inválido' });
        }

        // Pega o registro mais recente
        const resetRequest = resetRequests[0];

        console.log('Dados retornados da consulta de redefinição de senha:', resetRequest);

        // Verifica se o token é válido
        if (resetRequest.token !== token) {
            console.log('Token inválido');
            return res.status(400).json({ message: 'Token inválido' });
        }

        // Atualiza a senha do usuário
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('email', email);

        if (updateError) {
            console.error('Erro ao atualizar a senha do usuário:', updateError);
            return res.status(500).json({ message: 'Erro ao atualizar a senha' });
        }

        // Remove o token após o uso
        const { error: deleteError } = await supabase
            .from('password_resets')
            .delete()
            .eq('email', email)
            .eq('token', token);

        if (deleteError) {
            console.error('Erro ao remover o token:', deleteError);
            return res.status(500).json({ message: 'Erro ao remover o token de redefinição' });
        }

        res.status(200).json({ message: 'Senha redefinida com sucesso' });
    } catch (err) {
        console.error('Erro ao redefinir senha:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

const { data, error } = await supabase
    .from('password_resets')
    .select('*')
    .limit(1)
    .single();

console.log('Dados:', data);
console.error('Erro:', error);


module.exports = router;