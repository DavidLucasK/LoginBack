const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
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
router.post('/insert-redemption', async (req, res) => {
    const { userId, rewardId, pointsRequired } = req.body;

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
            text: `A Marcela resgatou um item da loja: ${rewardId} e foram: ${pointsRequired} pontos`,
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #333;">Resgate na Loja!!</h2>
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
                    <a href="${process.env.FRONTEND_URL}/reset.html?token=${token}&email=${email}" style="background-color: #7b30d0; color: #F5F3F4; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a>
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
router.get('/points', async (req, res) => {
    try {
        const { data: userPoints, error } = await supabase
            .from('user_points')
            .select('points')
            .eq('username', 'amor')
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
router.post('/update-points', async (req, res) => {
    const { username, pointsEarned } = req.body;

    if (!username || pointsEarned === undefined) {
        return res.status(400).json({ message: 'Dados incompletos' });
    }

    try {
        // Obter os pontos atuais do usuário
        const { data: userPoints, error: fetchError } = await supabase
            .from('user_points')
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
            .from('user_points')
            .update({ points: newPoints, last_updated: new Date() })
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

// Endpoint para verificar o status do quiz
router.get('/quiz-status', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('status_quiz')
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
router.post('/update-quiz-status', async (req, res) => {
    try {
        const { error } = await supabase
            .from('status_quiz')
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
router.get('/items', async (req, res) => {
    try {
        const { data: items, error } = await supabase
            .from('store')
            .select('*');

        if (error) {
            throw error;
        }

        res.status(200).json(items);
    } catch (err) {
        console.error('Erro ao listar itens:', err);
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
router.post('/update-profile', async (req, res) => {
    const { userId, name, email, phone, profileImage } = req.body;

    // Verifica se todos os campos necessários estão presentes
    if (!userId || !name || !email || !phone) {
        return res.status(400).json({ error: 'Todos os campos são necessários.' });
    }

    try {
        // Atualiza ou insere os dados na tabela profile_infos para o userId especificado
        const { data, error } = await supabase
            .from('profile_infos')
            .upsert([{ id: userId, name, email, phone, profile_image: profileImage }]);

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