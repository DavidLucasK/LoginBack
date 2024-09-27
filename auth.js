const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 10 * 1024 * 1024 } // Limite de 10MB
});

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

//Grava o resgate feito pelo usuário na tabela resgates
router.post('/insert-redemption/:userId', async (req, res) => {
    const {rewardId, pointsRequired } = req.body;
    const { userId } = req.params;

    try {
        //Buscando o nome do item
        const { data: storeData, error: storeError } = await supabase
            .from('store')
            .select('name')
            .eq('id', rewardId)
            .single();

        if (storeError) {
            throw storeError;
        }

        const itemStore = storeData.name;

        // Inserir o resgate na tabela resgates
        const { error } = await supabase
            .from('resgates')
            .insert([{ user_id: userId, reward_id: rewardId, created_at: new Date(), pontos_qtd: pointsRequired, item_store: itemStore }]);

        if (error) {
            throw error;
        }
        const mailOptions = {
            from: process.env.EMAIL,
            to: "davidlucasfr70@gmail.com",
            subject: 'Resgate na Loja!!',
            text: `O usuario com id ${userId} resgatou um item da loja: ${rewardId} e foram: ${pointsRequired} pontos`,
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #333;">Resgate na Loja!!</h2>
                    <span style="color: #666;">O usuario com id ${userId} resgatou um item da loja: ${rewardId} e foram: ${pointsRequired} pontos</span>
                    <p style="color: #666;">Clique abaixo para ver o resgate na loja da Supabase</p>
                    <a href="https://supabase.com/dashboard/project/ojxyfmbpzjypidukzlqf/editor/30141" style="background-color: #bd11a8; color: #F5F3F4; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Resgate da Ma</a>
                </div>
                `
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

        res.status(200).json({ message: 'Resgate registrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar resgate:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.post('/insert-redemption-test', async (req, res) => {
    const { rewardId, pointsRequired } = req.body;

    try {
        // Inserir o resgate na tabela resgates
        const { error } = await supabase
            .from('resgates')
            .insert([{ user_id: 999, reward_id: rewardId, created_at: new Date(), pontos_qtd: pointsRequired }]);

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Resgate registrado com sucesso!' });
    } catch (err) {
        console.error('Erro ao registrar resgate:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para upload de fotos
router.post('/upload', upload.single('photo'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    try {
        // Gerar um nome de arquivo único com base na data e hora
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.originalname}`;

        const { data, error } = await supabase.storage
            .from('fotos')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            throw error;
        }

        const fileUrl = `${supabaseUrl}/storage/v1/object/public/fotos/${fileName}`;
        res.status(200).json({ message: 'Foto enviada com sucesso!', fileUrl });
    } catch (err) {
        console.error('Erro ao fazer upload da foto:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.post('/foto_post', upload.single('photo'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    try {
        // Gerar um nome de arquivo único com base na data e hora
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.originalname}`;

        const { data, error } = await supabase.storage
            .from('posts')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            throw error;
        }

        const fileUrl = `${supabaseUrl}/storage/v1/object/public/posts/${fileName}`;
        res.status(200).json({ message: 'Foto enviada com sucesso!', fileUrl });
    } catch (err) {
        console.error('Erro ao fazer upload da foto:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.post('/foto_store', upload.single('photo'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    try {
        // Gerar um nome de arquivo único com base na data e hora
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.originalname}`;

        const { data, error } = await supabase.storage
            .from('store_images')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            throw error;
        }

        const fileUrl = `${supabaseUrl}/storage/v1/object/public/store_images/${fileName}`;
        res.status(200).json({ message: 'Foto enviada com sucesso!', fileUrl });
    } catch (err) {
        console.error('Erro ao fazer upload da foto:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.post('/upload_imagepic', upload.single('photo'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    try {
        // Gerar um nome de arquivo único com base na data e hora
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.originalname}`;

        const { data, error } = await supabase.storage
            .from('profile_pics')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            throw error;
        }

        const fileUrl = `${supabaseUrl}/storage/v1/object/public/profile_pics/${fileName}`;
        res.status(200).json({ message: 'Foto enviada com sucesso!', fileUrl });
    } catch (err) {
        console.error('Erro ao fazer upload da foto:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
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
            return res.status(205).json({ message: 'Usuario com esse email já existe' });
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
            return res.status(400).json({ message: `Usuário ${user} não existe!` });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: `Senha incorreta.` });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, userId: user.id, message: 'Login bem-sucedido!' });
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
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // Expira em 15 minutos

        // Inserir o token e a data de expiração diretamente
        const { error: insertError } = await supabase
            .from('password_resets')
            .insert([{ email, token, created_at: now, expires_at: expiresAt }]);

        if (insertError) {
            throw insertError;
        }

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'Redefinição de Senha',
            text: `Você solicitou a redefinição de senha da sua conta. Clique no link para redefinir: ${process.env.FRONTEND_URL}/reset.html?token=${token}&email=${email}`,
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #333;">Redefinição de Senha</h2>
                    <p style="color: #666;">Você solicitou a redefinição de senha da sua conta.</p>
                    <p style="color: #666;">Clique no botão abaixo para redefinir sua senha:</p>
                    <div style="display: grid; align-items: center;">
                        <a href="${process.env.FRONTEND_URL}/redirect-to-app?token=${token}&email=${email}" style="background-color: #7b30d0; color: #F5F3F4; margin-bottom: 20px; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Redefinir Senha
                        </a>
                    </div>
                    <p style="color: #999; margin-top: 20px;">Se você não solicitou esta alteração, por favor ignore este e-mail.</p>
                </div>
            `
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

// Endpoint para resetar a senha
router.post('/reset', async (req, res) => {
    const { email, token, newPassword } = req.body;

    console.log('Requisição recebida para redefinir senha');
    console.log('Email:', email);
    console.log('Token:', token);
    console.log('Nova Senha:', newPassword);

    if (!email || !token || !newPassword) {
        console.log('Dados incompletos na requisição');
        return res.status(400).json({ message: 'Dados incompletos' });
    }

    try {
        // Verificar o token
        const { data: resetRequest, error: resetError } = await supabase
            .from('password_resets')
            .select('*')
            .eq('email', email)
            .eq('token', token)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Verifica se houve erro na consulta ou se não encontrou o registro
        if (resetError || !resetRequest) {
            console.log('Dados retornados da consulta de redefinição de senha:', resetRequest);
            console.log('Erro na consulta de redefinição de senha:', resetError);
            return res.status(400).json({ message: 'Token inválido ou expirado' });
        }

        // Verificar se o token expirou
        const expiresAt = new Date(resetRequest.expires_at);
        if (new Date() > expiresAt) {
            return res.status(400).json({ message: 'Token expirado' });
        }

        // Atualizar a senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('email', email);

        if (updateError) {
            throw updateError;
        }

        // Remover o token após a redefinição da senha
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

// Endpoint para buscar a quantidade de pontos de um usuário
router.get('/points/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data: userPoints, error } = await supabase
            .from('user_points')
            .select('points')
            .eq('id', userId)
            .single();  // Obtém um único registro

        if (error) {
            throw error;
        }

        if (!userPoints) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        res.status(200).json({ points: userPoints.points });
    } catch (err) {
        console.error('Erro ao buscar pontos:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.get('/points-test', async (req, res) => {
    try {
        const { data: userPoints, error } = await supabase
            .from('user_points_teste')
            .select('points')
            .eq('username', 'teste')
            .single();

        if (error) {
            throw error;
        }

        if (!userPoints) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        res.status(200).json({ points: userPoints.points });
    } catch (err) {
        console.error('Erro ao buscar pontos:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para atualizar pontos do usuário após um minigame
router.post('/update-points/:userId', async (req, res) => {
    const { userId } = req.params;
    const { pointsEarned } = req.body;

    if (!userId || pointsEarned === undefined) {
        return res.status(400).json({ message: 'Dados incompletos' });
    }

    try {
        // Obter os pontos atuais do usuário
        console.error('obtendo dados do user')
        const { data: userPoints, error: fetchError } = await supabase
            .from('user_points')
            .select('points')
            .eq('id', userId)
            .single();
        console.error('dados obtidos com user:', userId)

        if (fetchError || !userPoints) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Calcular novos pontos
        const newPoints = userPoints.points + (pointsEarned);

        // Atualizar pontos do usuário
        console.error('tentando atualizar')
        const { error: updateError } = await supabase
            .from('user_points')
            .update({ points: newPoints, last_updated: new Date() })
            .eq('id', userId);

        console.error('Foi')

        if (updateError) {
            throw updateError;
        }

        res.status(200).json({ message: 'Pontos atualizados com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar pontos:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.post('/update-points-test', async (req, res) => {
    const { username, pointsEarned } = req.body;

    if (!username || pointsEarned === undefined) {
        return res.status(400).json({ message: 'Dados incompletos' });
    }

    try {
        // Obter os pontos atuais do usuário
        const { data: userPoints, error: fetchError } = await supabase
            .from('user_points_teste')
            .select('points')
            .eq('username', username)
            .single();

        if (fetchError || !userPoints) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        // Calcular novos pontos
        const newPoints = userPoints.points + (pointsEarned);

        // Atualizar pontos do usuário
        const { error: updateError } = await supabase
            .from('user_points_teste')
            .update({ points: newPoints })
            .eq('username', username);

        if (updateError) {
            throw updateError;
        }

        res.status(200).json({ message: 'Pontos atualizados com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar pontos:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para buscar perguntas e respostas aleatórias
router.get('/questions', async (req, res) => {
    try {
        // Buscar 5 perguntas aleatórias usando a função RPC
        const { data: questions, error: questionsError } = await supabase
            .rpc('get_random_questions', { p_limit: 7 });

        if (questionsError) {
            throw questionsError;
        }

        if (questions.length === 0) {
            return res.status(404).json({ message: 'Nenhuma pergunta encontrada' });
        }

        // Buscar respostas para as perguntas selecionadas
        const questionIds = questions.map(question => question.id);
        const { data: answers, error: answersError } = await supabase
            .from('respostas')
            .select('id, pergunta_id, resposta, is_correta')  // Qualificar colunas explicitamente
            .in('pergunta_id', questionIds); // Filtra as respostas pelas perguntas selecionadas

        if (answersError) {
            throw answersError;
        }

        // Organizar as respostas por pergunta
        const questionsWithAnswers = questions.map(question => ({
            ...question,
            answers: answers.filter(answer => answer.pergunta_id === question.id)
        }));

        res.status(200).json(questionsWithAnswers);
    } catch (err) {
        console.error('Erro ao buscar perguntas e respostas:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para buscar perguntas e respostas com id da pergunta
router.get('/questionSingle/:idPergunta', async (req, res) => {
    const { idPergunta } = req.params;
    try {
        // Buscar a pergunta com o id fornecido
        const { data: question, error: questionError } = await supabase
            .from('perguntas')
            .select('*')  // Qualificar colunas explicitamente
            .eq('id', idPergunta)
            .single(); // Para garantir que apenas uma pergunta seja retornada

        if (questionError) {
            throw questionError;
        }

        if (!question) {
            return res.status(404).json({ message: 'Pergunta não encontrada' });
        }

        // Buscar respostas para a pergunta selecionada
        const { data: answers, error: answersError } = await supabase
            .from('respostas')
            .select('id, pergunta_id, resposta, is_correta')  // Qualificar colunas explicitamente
            .eq('pergunta_id', idPergunta); // Filtra as respostas pela pergunta selecionada

        if (answersError) {
            throw answersError;
        }

        // Retornar a pergunta e suas respostas
        res.status(200).json({
            question,
            answers,
        });
    } catch (err) {
        console.error('Erro ao buscar pergunta e respostas:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para criar perguntas e respostas
router.post('/createQuestion', async (req, res) => {
    const { pergunta, corretaId, partnerId, respostas } = req.body;

    try {
        // Inserir a nova pergunta na tabela perguntas
        const { data: newQuestion, error: questionError } = await supabase
            .from('perguntas')
            .insert([
                {
                    pergunta: pergunta,
                    resposta_correta: corretaId, // O ID da resposta correta
                    partner_id: partnerId
                }
            ])
            .select('*')
            .single(); // Obtém a nova pergunta inserida

        if (questionError) {
            throw questionError;
        }

        // Verifique se a resposta correta existe dentro das respostas fornecidas
        const respostaCorreta = respostas.find((resposta) => resposta.id === corretaId);
        if (!respostaCorreta) {
            return res.status(400).json({ message: 'A resposta correta fornecida não está presente nas respostas enviadas.' });
        }

        // Inserir as respostas na tabela respostas
        const respostasData = respostas.map((resposta) => ({
            pergunta_id: newQuestion.id, // Referencia o ID da nova pergunta
            resposta: resposta.texto, // Supondo que cada resposta tem um campo 'texto'
            is_correta: resposta.id === corretaId, // Verifica se a resposta é a correta pelo id
        }));

        const { error: answersError } = await supabase
            .from('respostas')
            .insert(respostasData);

        if (answersError) {
            throw answersError;
        }

        res.status(201).json({
            message: 'Pergunta e respostas criadas com sucesso!',
            question: newQuestion,
            respostas: respostasData,
        });
    } catch (err) {
        console.error('Erro ao criar pergunta e respostas:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para editar uma pergunta e suas respostas
router.post('/editQuestion/:idPergunta', async (req, res) => {
    const { idPergunta } = req.params;
    const { pergunta, indiceCorreta, respostas } = req.body; // Captura a pergunta, o índice da resposta correta e as respostas

    // Verifique se o índice da resposta correta está entre 1 e 4
    if (indiceCorreta < 1 || indiceCorreta > 4) {
        return res.status(400).json({ message: 'O índice da resposta correta deve estar entre 1 e 4.' });
    }

    try {
        // Atualiza a pergunta
        const { error: updateQuestionError } = await supabase
            .from('perguntas')
            .update({ pergunta, resposta_correta: indiceCorreta }) // Atualiza a pergunta com o novo valor
            .eq('id', idPergunta); // Filtra pela pergunta que deve ser atualizada

        if (updateQuestionError) {
            throw updateQuestionError;
        }

        // Atualiza as respostas
        for (const resposta of respostas) {
            const { id, resposta: respostaTexto } = resposta;

            // Verifica se a resposta atual deve ser marcada como correta
            const isCorreta = respostas.findIndex(r => r.id === id) === (indiceCorreta - 1); // Ajusta o índice para 0-3

            const { error: updateAnswerError } = await supabase
                .from('respostas')
                .update({
                    resposta: respostaTexto,
                    is_correta: isCorreta // Define se a resposta é correta com base na lógica
                })
                .eq('id', id); // Filtra pela ID da resposta que deve ser atualizada

            if (updateAnswerError) {
                throw updateAnswerError;
            }
        }

        res.status(200).json({ message: 'Pergunta e respostas atualizadas com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar pergunta e respostas:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para excluir uma pergunta e suas respostas
router.delete('/deleteQuestion/:idPergunta', async (req, res) => {
    const { idPergunta } = req.params;

    try {
        // Primeiro, exclui as respostas associadas à pergunta
        const { error: deleteAnswersError } = await supabase
            .from('respostas')
            .delete()
            .eq('pergunta_id', idPergunta); // Filtra as respostas pela pergunta

        if (deleteAnswersError) {
            throw deleteAnswersError;
        }

        // Em seguida, exclui a pergunta
        const { error: deleteQuestionError } = await supabase
            .from('perguntas')
            .delete()
            .eq('id', idPergunta); // Filtra pela pergunta a ser excluída

        if (deleteQuestionError) {
            throw deleteQuestionError;
        }

        res.status(200).json({ message: 'Pergunta e respostas excluídas com sucesso!' });
    } catch (err) {
        console.error('Erro ao excluir pergunta e respostas:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para buscar perguntas e respostas TODAS
router.get('/questionsAll/:partnerId', async (req, res) => {
    const { partnerId } = req.params;
    try {
        const { data: questions, error: questionsError } = await supabase
            .from('perguntas')
            .select('*')  // Qualificar colunas explicitamente
            .eq('partner_id', partnerId); // Filtra as respostas pelas perguntas selecionadas

        if (questionsError) {
            throw questionsError;
        }

        // Se não houver perguntas, retorna um array vazio ao invés de um erro 404
        if (!questions || questions.length === 0) {
            return res.status(203).json([]);  // Retorna um array vazio
        }

        res.status(200).json(questions);
    } catch (err) {
        console.error('Erro ao buscar perguntas e respostas:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para verificar o status do quiz
router.get('/quiz-status/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data, error } = await supabase
            .from('status_quiz')
            .select('is_completed')
            .eq('id', userId)
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json({ is_completed: data.is_completed });
    } catch (err) {
        console.error('Erro ao verificar status do quiz:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.get('/quiz-status-test', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('status_quiz-teste')
            .select('is_completed')
            .eq('id', 1)
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json({ is_completed: data.is_completed });
    } catch (err) {
        console.error('Erro ao verificar status do quiz:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para atualizar o status do quiz
router.post('/update-quiz-status/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { error } = await supabase
            .from('status_quiz')
            .update({
                data_ultimo_quiz: new Date(),
                is_completed: true
            })
            .eq('id', userId);

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Status do quiz atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar status do quiz:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.post('/update-quiz-status-test', async (req, res) => {
    try {
        const { error } = await supabase
            .from('status_quiz-teste')
            .update({
                data_ultimo_quiz: new Date(),
                is_completed: true
            })
            .eq('id', 1);

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Status do quiz atualizado com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar status do quiz:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para listar todos os itens da loja
router.get('/items/:partnerId', async (req, res) => {
    const { partnerId } = req.params;
    //partnerId é do usuario que criou o item pra você
    try {
        const { data: items, error } = await supabase
            .from('store')
            .select('*')
            .eq('id_partner_view', partnerId)
            .order('id', { ascending: true });

        if (error) {
            throw error;
        }

        res.status(200).json(items);
    } catch (err) {
        console.error('Erro ao listar itens:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para listar todos os itens da loja
router.post('/create_item/:partnerId', async (req, res) => {
    const { title_item, desc_item, points, image_url } = req.body;
    const { partnerId } = req.params;

    if (!title_item) {
        return res.status(400).json({ error: 'Titulo do item é necessário.' });
    }

    if (!desc_item) {
        return res.status(400).json({ error: 'Descrição do item é necessária.' });
    }

    if (!points) {
        return res.status(400).json({ error: 'Pontos são necessários.' });
    }

    if (!image_url) {
        return res.status(400).json({ error: 'Imagem do item é necessária.' });
    }

    if (!partnerId) {
        return res.status(400).json({ error: 'partnerId é necessário.' });
    }

    try {
        const { data, error } = await supabase
        .from('store')
        .insert([
            {
                name: title_item,
                description: desc_item,
                points_required: points,
                image_url: image_url,
                id_partner_view: partnerId,
            }
        ]);

        if (error) {
            throw error;
        }

        res.status(201).json({ message: 'Item criado com sucesso!', data });

    } catch (err) {
        console.error('Erro ao criar item:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para atualizar um item da loja
router.post('/update_item/:itemId', async (req, res) => {
    const { itemName, itemDesc, itemPoints } = req.body;
    const { itemId } = req.params;

    try {
        // Atualizando o item com o itemId fornecido
        const { data, error } = await supabase
            .from('store')
            .update({
                name: itemName,
                description: itemDesc,
                points_required: itemPoints,
            })
            .eq('id', itemId); // Filtra pelo itemId

        if (error) {
            throw error; // Lança um erro se houver
        }

        // Se não houver erro, retorna os dados da exclusão
        res.status(200).json({ message: 'Item atualizado com sucesso!', data });

    } catch (err) {
        console.error('Erro ao excluir item:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para excluir um item da loja
router.delete('/delete_item/:itemId', async (req, res) => {
    const { itemId } = req.params;

    try {
        // Excluindo o item com o itemId fornecido
        const { data, error } = await supabase
            .from('store')
            .delete()
            .eq('id', itemId); // Filtra pelo itemId

        if (error) {
            throw error; // Lança um erro se houver
        }

        // Se não houver erro, retorna os dados da exclusão
        res.status(200).json({ message: 'Item excluído com sucesso!', data });

    } catch (err) {
        console.error('Erro ao excluir item:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});


//Posts com comentarios
router.get('/posts', async (req, res) => {
    try {
        // Capturar query params: page, limit, search, sortBy
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'data'; // Ordena por data de criação por padrão

        // Fazer a busca na tabela de 'posts' com paginação, filtros e ordenação
        const { data: posts, error: postsError } = await supabase
            .from('posts')
            .select('*') // Selecione apenas os campos necessários
            .order(sortBy, { ascending: false }) // Ordena os resultados
            .range(offset, offset + limit - 1); // Paginação

        if (postsError) {
            throw postsError;
        }

        // Contagem total de posts para controle de páginas no frontend
        const { count } = await supabase
            .from('posts')
            .select('id', { count: 'exact' });

        // Log para verificar os posts retornados
        console.log('Posts:', posts);

        // Buscando comentários para os posts encontrados
        const postIds = posts.map((post) => post.id); // Obter os IDs dos posts
        const { data: comments, error: commentsError } = await supabase
            .from('comments')
            .select('id_post, comment_text, username') // Selecionar 'id_post', 'comment_text' e 'username'
            .in('id_post', postIds); // Busca os comentários onde 'id_post' está na lista de IDs de posts

        if (commentsError) {
            throw commentsError;
        }

        // Log para verificar os comentários retornados
        console.log('Comentários:', comments);

        // Agrupar os comentários por id_post e incluir o username
        const commentsByPostId = comments.reduce((acc, comment) => {
            const postId = comment.id_post;
            if (!acc[postId]) {
                acc[postId] = [];
            }
            // Adiciona o texto do comentário e o username
            acc[postId].push({
                comment_text: comment.comment_text,
                username: comment.username
            });
            return acc;
        }, {});

        // Adicionar os comentários e usernames aos respectivos posts
        const postsWithComments = posts.map((post) => ({
            ...post,
            comments: commentsByPostId[post.id] || [], // Adiciona os comentários (com usernames) ou uma lista vazia se não houver
        }));

        // Log para depuração
        console.log('Posts com Comentários e Usernames:', postsWithComments);

        // Retornar os dados paginados e a contagem total
        res.status(200).json({
            posts: postsWithComments,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalPosts: count,
        });
    } catch (err) {
        console.error('Erro ao buscar posts:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.get('/post/:id', async (req, res) => {
    try {
        // Capturar o id do post a partir dos parâmetros da rota
        const postId = req.params.id;

        if (!postId) {
            return res.status(400).json({ message: 'Post ID is required' });
        }

        // Buscar o post com o id fornecido
        const { data: post, error: postError } = await supabase
            .from('posts')
            .select('*')
            .eq('id', postId) // Filtra pelo id do post
            .single(); // Retorna um único post

        if (postError) {
            throw postError;
        }

        // Se o post não for encontrado
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Buscar os comentários associados ao post
        const { data: comments, error: commentsError } = await supabase
            .from('comments')
            .select('id_post, comment_text, username')
            .eq('id_post', postId); // Filtra os comentários pelo id do post

        if (commentsError) {
            throw commentsError;
        }

        // Adicionar os comentários ao post
        const postWithComments = {
            ...post,
            comments: comments || [], // Se não houver comentários, retorna um array vazio
        };

        // Retornar o post com seus comentários
        res.status(200).json(postWithComments);
    } catch (err) {
        console.error('Erro ao buscar o post:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});


router.post('/upload_post', async (req, res) => {
    const { nome_foto, desc_foto, username } = req.body;

    if (!nome_foto) {
        return res.status(400).json({ error: 'Nome da foto é necessário.' });
    }

    if (!username) {
        return res.status(400).json({ error: 'Username é necessário.' });
    }

    try {

        const now = new Date();
        now.setHours(now.getHours() - 3); // Subtrai 3 horas
        const adjustedDate = now.toISOString();

        const { data, error } = await supabase
            .from('posts')
            .insert([
                {
                    data: adjustedDate,
                    username: username,
                    nome_foto: nome_foto,
                    desc_foto: desc_foto,
                    is_liked: false
                }
            ]);

        if (error) {
            throw error;
        }

        res.status(201).json({ message: 'Post criado com sucesso!', data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para inserir ou atualizar informações do perfil
router.post('/update-profile/:userId', async (req, res) => {
    const { name, email, phone, profileImage } = req.body;
    const { userId } = req.params

    // Verifica se todos os campos necessários estão presentes
    if (!name || !email || !phone) {
        return res.status(400).json({ error: 'Todos os campos são necessários.' });
    }

    try {
        // Atualiza ou insere os dados na tabela profile_infos para o userId especificado
        const { data, error } = await supabase
            .from('profile_infos')
            .update([{ name, email, phone, profile_image: profileImage }])
            .eq ('id', userId);

        if (error) {
            throw error;
        }

        res.status(200).json({ message: 'Perfil atualizado com sucesso!', data });
    } catch (err) {
        console.error('Erro ao atualizar perfil:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});


router.get('/get-profile/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        // Busca os dados na tabela profile_infos com base no userId
        const { data, error } = await supabase
            .from('profile_infos')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            return res.status(404).json({ message: 'Perfil não encontrado.' });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error('Erro ao buscar perfil:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

router.post('/like', async (req, res) => {
    try {
        // Capturar o corpo da requisição: likedPostIds
        const { likedPostIds } = req.body;

        if (!Array.isArray(likedPostIds) || likedPostIds.length === 0) {
            return res.status(400).json({ message: 'Invalid data' });
        }

        // Atualizar o campo 'is_liked' dos posts na tabela
        const { data, error } = await supabase
            .from('posts')
            .update({ is_liked: true })
            .in('id', likedPostIds);

        if (error) {
            throw error;
        }

        // Retornar sucesso
        res.status(200).json({ message: 'Likes updated successfully', updatedPosts: data });
    } catch (err) {
        console.error('Erro ao atualizar likes:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

// Endpoint para adicionar um comentário
router.post('/comment', async (req, res) => {
    try {
        // Capturar o corpo da requisição: id_post e comment_text
        const { id_post, comment_text, username } = req.body;

        if (!id_post || !comment_text || typeof comment_text !== 'string') {
            return res.status(400).json({ message: 'Invalid data' });
        }

        const now = new Date();
        now.setHours(now.getHours() - 3); // Subtrai 3 horas
        const adjustedDate = now.toISOString();

        // Inserir o novo comentário na tabela 'comments'
        const { data, error } = await supabase
            .from('comments')
            .insert([
                {
                    id_post: id_post,
                    comment_text: comment_text,
                    created_at: adjustedDate,
                    username: username,
                    // Você pode adicionar mais campos aqui, como a data do comentário, se necessário
                }
            ]);

        if (error) {
            throw error;
        }

        // Verifica se `data` contém pelo menos um item
        if (data && data.length > 0) {
            // Retornar sucesso
            res.status(200).json({ message: 'Comment added successfully', comment: data[0] });
        } else {
            // Caso `data` esteja vazio
            res.status(200).json({ message: 'comentario vazio' });
        }
    } catch (err) {
        console.error('Erro ao adicionar comentário:', err);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});



module.exports = router;