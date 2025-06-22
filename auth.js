const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { createClient } = require("@supabase/supabase-js");
const multer = require("multer");

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limite de 10MB
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configura o transporte de e-mail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ------------------- Endpoints do Login ------------------- //

// Endpoint para registro
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (existingUserError && existingUserError.code !== "PGRST116") {
      throw existingUserError;
    }

    if (existingUser) {
      return res
        .status(205)
        .json({ message: "Usuario com esse email já existe" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from("users")
      .insert([{ email, password: hashedPassword }]);

    if (error) {
      throw error;
    }

    res.status(201).json({ message: "Conta criada com sucesso!" });
  } catch (err) {
    console.error("Erro ao registrar o usuário:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error && error.code === "PGRST116") {
      return res.status(400).json({
        message: `Senha incorreta para ${email} ou email não cadastrado`,
      });
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

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token, userId: user.id, message: "Login bem-sucedido!" });
  } catch (err) {
    console.error("Erro ao fazer login:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para solicitar redefinição de senha
router.post("/forgot", async (req, res) => {
  const { email } = req.body;

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(400).json({ message: "Usuário não encontrado" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // Expira em 15 minutos

    // Inserir o token e a data de expiração diretamente
    const { error: insertError } = await supabase
      .from("password_resets")
      .insert([{ email, token, created_at: now, expires_at: expiresAt }]);

    if (insertError) {
      throw insertError;
    }

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "Redefinição de Senha",
      text: `Você solicitou a redefinição de senha da sua conta. Clique no link para redefinir: ${process.env.FRONTEND_URL}/reset.html?token=${token}&email=${email}`,
      html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #333;">Redefinição de Senha</h2>
                    <p style="color: #666;">Você solicitou a redefinição de senha da sua conta.</p>
                    <p style="color: #666;">Clique no botão abaixo para redefinir sua senha:</p>
                    <div style="display: grid; align-items: center;">
                        <a href="${process.env.FRONTEND_URL}/redirect.html?token=${token}&email=${email}" style="background-color: #7b30d0; color: #F5F3F4; margin-bottom: 20px; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Redefinir Senha via App
                        </a>
                    </div>
                    <p style="color: #999; margin-top: 20px;">Se você não solicitou esta alteração, por favor ignore este e-mail.</p>
                </div>
            `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Erro ao enviar e-mail:", err);
        return res.status(500).json({ message: "Erro ao enviar e-mail!" });
      } else {
        console.log("E-mail enviado:", info.response);
        return res.status(200).json({ message: "E-mail enviado com sucesso!" });
      }
    });
  } catch (err) {
    console.error("Erro ao solicitar redefinição de senha:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para resetar a senha
router.post("/reset", async (req, res) => {
  const { email, token, newPassword } = req.body;

  console.log("Requisição recebida para redefinir senha");
  console.log("Email:", email);
  console.log("Token:", token);
  console.log("Nova Senha:", newPassword);

  if (!email || !token || !newPassword) {
    console.log("Dados incompletos na requisição");
    return res.status(400).json({ message: "Dados incompletos" });
  }

  try {
    // Verificar o token
    const { data: resetRequest, error: resetError } = await supabase
      .from("password_resets")
      .select("*")
      .eq("email", email)
      .eq("token", token)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Verifica se houve erro na consulta ou se não encontrou o registro
    if (resetError || !resetRequest) {
      console.log(
        "Dados retornados da consulta de redefinição de senha:",
        resetRequest
      );
      console.log("Erro na consulta de redefinição de senha:", resetError);
      return res.status(400).json({ message: "Token inválido ou expirado" });
    }

    // Verificar se o token expirou
    const expiresAt = new Date(resetRequest.expires_at);
    if (new Date() > expiresAt) {
      return res.status(400).json({ message: "Token expirado" });
    }

    // Atualizar a senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("email", email);

    if (updateError) {
      throw updateError;
    }

    // Remover o token após a redefinição da senha
    await supabase
      .from("password_resets")
      .delete()
      .eq("email", email)
      .eq("token", token);

    res.status(200).json({ message: "Senha redefinida com sucesso" });
  } catch (err) {
    console.error("Erro ao redefinir senha:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// ------------------- Fim Endpoints do Login ------------------- //

// Enviar solicitação
router.post("/inviting/:userId/:partnerId", async (req, res) => {
  const { userId, partnerId } = req.params;

  try {
    // Verificar se o partnerId existe na tabela profile_infos e se o campo partner é diferente de NULL
    const { data: profileData, error: profileError } = await supabase
      .from("profile_infos")
      .select("partner")
      .eq("id", partnerId)
      .single(); // Retorna apenas um resultado

    if (profileError) {
      return res
        .status(404)
        .json({ message: "Erro ao buscar informações do parceiro" });
    }

    // Se o campo 'partner' não for null, significa que o usuário já possui um parceiro
    if (profileData && profileData.partner !== null) {
      return res.status(201).json({ message: "Esse usuário já tem parceiro" });
    }

    // Inserir o novo invite na tabela 'invites'
    const { data: inviteData, error: inviteError } = await supabase
      .from("invites")
      .insert([
        {
          id_partner: partnerId,
          id_user_invite: userId,
          date: new Date().toISOString(), // Definir a data atual em formato ISO
        },
      ]);

    if (inviteError) {
      return res.status(404).json({ message: "Invite não enviado" });
    }

    // Buscar todos os dados da tabela profile_infos para o userId
    const { data: userProfileData, error: userProfileError } = await supabase
      .from("profile_infos")
      .select("*")
      .eq("id", userId); // Substitua pelo campo correspondente se o id for diferente

    if (userProfileError) {
      return res
        .status(404)
        .json({ message: "Erro ao buscar informações do usuário" });
    }

    // Retornar os dados do invite e do perfil do usuário
    res.status(200).json({
      message: "Invite enviado com sucesso",
      inviteData,
      userProfileData,
    });
  } catch (err) {
    console.error("Erro ao enviar invite:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Invites para o userId
router.get("/get_invites/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Buscar todos os invites onde id_partner é igual ao userId
    const { data: invitesData, error: invitesError } = await supabase
      .from("invites")
      .select("id_user_invite, id_invite") // Seleciona id_user_invite e id_invite
      .eq("id_partner", userId);

    if (invitesError) {
      return res
        .status(404)
        .json({ message: "Erro ao buscar informações dos invites" });
    }

    // Se não houver invites, retornar uma mensagem apropriada
    if (!invitesData || invitesData.length === 0) {
      return res.status(201).json({ message: "Nenhum invite encontrado" });
    }

    // Extrair todos os id_user_invite
    const userInviteIds = invitesData.map((invite) => invite.id_user_invite);

    // Fazer um select na tabela profile_infos com os ids dos invites
    const { data: profilesData, error: profilesError } = await supabase
      .from("profile_infos")
      .select("*")
      .in("id", userInviteIds); // Usa a cláusula IN para buscar múltiplos ids

    if (profilesError) {
      return res
        .status(404)
        .json({ message: "Erro ao buscar informações dos perfis" });
    }

    // Combinar os perfis com seus respectivos invites
    const profilesWithInviteIds = profilesData.map((profile) => {
      // Encontrar o invite correspondente para o profile atual
      const invite = invitesData.find(
        (inv) => inv.id_user_invite === profile.id
      );

      return {
        ...profile, // Dados do perfil
        id_invite: invite?.id_invite, // Adiciona o id_invite do invite correspondente
      };
    });

    // Retornar os dados combinados dos perfis e invites
    res.status(200).json({
      message: "Dados dos invites e perfis encontrados",
      profiles: profilesWithInviteIds,
    });
  } catch (err) {
    console.error("Erro ao buscar invites:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Aceitar ou recusar invite
router.post("/handle_invite/:userId", async (req, res) => {
  const { userId } = req.params;
  const { inviteId: inviteIdString, option } = req.body; // capturando inviteId como string

  // Verifica se inviteId foi fornecido e é válido
  if (!inviteIdString || isNaN(inviteIdString)) {
    console.error("Erro: inviteId inválido ou ausente:", inviteIdString);
    return res
      .status(400)
      .json({ message: "ID de convite inválido ou ausente." });
  }

  // Converte o inviteId para número inteiro (int4)
  const inviteId = parseInt(inviteIdString, 10);

  if (!Number.isInteger(inviteId)) {
    console.error("Erro: inviteId não é um número inteiro:", inviteId);
    return res.status(400).json({ message: "ID de convite inválido." });
  }

  if (option !== 1 && option !== 2) {
    console.error("Erro: opção inválida:", option);
    return res.status(400).json({ message: "Opção inválida." });
  }

  try {
    // Log para verificar inviteId após conversão
    console.log("Buscando convite com ID:", inviteId);

    // Verifica se o invite existe
    const { data: inviteData, error: inviteError } = await supabase
      .from("invites")
      .select("*")
      .eq("id_invite", inviteId)
      .single(); // Garante que apenas um registro é retornado

    if (inviteError) {
      console.error("Erro ao consultar o convite:", inviteError);
      return res
        .status(500)
        .json({ message: "Erro ao consultar o convite.", error: inviteError });
    }

    if (!inviteData) {
      return res.status(404).json({ message: "Convite não encontrado." });
    }

    const partnerInvite = inviteData.id_user_invite;

    // Inicia uma transação para garantir que todas as operações sejam executadas juntas
    const { error: transactionError } = await supabase.rpc(
      "handle_invite_transaction",
      {
        user_id: userId,
        partner_id: partnerInvite,
        invite_id: inviteId,
        option: option,
      }
    );

    if (transactionError) {
      console.error("Erro ao executar a transação:", transactionError);
      return res
        .status(500)
        .json({ message: "Erro ao processar a solicitação." });
    }

    // Respostas apropriadas para aceitar ou recusar a solicitação
    if (option === 1) {
      return res
        .status(200)
        .json({ message: "Solicitação aceita com sucesso." });
    } else if (option === 2) {
      return res
        .status(200)
        .json({ message: "Solicitação recusada com sucesso." });
    }
  } catch (error) {
    console.error("Erro ao lidar com a solicitação de convite:", error);
    res.status(500).json({ message: "Erro no servidor." });
  }
});

// ------------------- Endpoints de Frases ------------------- //

// Endpoint para pegar uma linha aleatória pelos textos do userId
router.get("/get-texts/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { data: texto, error } = await supabase
      .from("texts")
      .select("id, texto1, texto2, texto3")
      .eq("user_id", userId)
      .order("RANDOM()", { ascending: true })
      .limit(1)
      .single(); // <- Aqui força o retorno como objeto único, não array

    if (error) {
      console.error(`Erro ao buscar texto para userId:${userId}`, error);
      return res.status(500).json({ message: "Erro ao buscar texto", error });
    }

    if (!texto) {
      return res
        .status(404)
        .json({ message: "Nenhum texto encontrado para esse userId" });
    }

    return res.status(200).json({
      message: "Texto retornado com sucesso!",
      texto,
    });
  } catch (err) {
    console.error(`Erro inesperado ao pegar texto para userId:${userId}`, err);
    res
      .status(500)
      .json({
        message: `Erro inesperado ao pegar texto para userId:${userId}`,
      });
  }
});

// Endpoint para buscar Text com idText
router.get("/textSingle/:idText", async (req, res) => {
  const { idText } = req.params;
  try {
    // Buscar o texto com o id fornecido
    const { data: textData, error: textError } = await supabase
      .from("texts")
      .select("*")
      .eq("id", idText)
      .single(); // Para garantir que apenas um texto seja retornado

    if (textError) {
      throw textError;
    }

    if (!textData) {
      return res.status(404).json({ message: "Texto não encontrada" });
    }

    // Retornar texto pelo textId
    res.status(200).json({ message: "Texto retornado com sucesso", textData });
  } catch (err) {
    console.error("Erro ao buscar pergunta e respostas:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para editar um texto do parceiro
router.post("/editText/:idText", async (req, res) => {
  const { idText } = req.params;
  const { textos1, textos2, textos3 } = req.body;

  try {
    // Atualiza a pergunta
    const { error: updateQuestionError } = await supabase
      .from("texts")
      .update({ texto1: textos1, texto2: textos2, texto3: textos3 })
      .eq("id", idText);

    if (updateQuestionError) {
      throw updateQuestionError;
    }

    res.status(200).json({ message: "Texto atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar texto:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para criar textos para parceiro
router.post("/createText", async (req, res) => {
  const { partnerId, textos1, textos2, textos3 } = req.body;

  try {
    // Inserir o novo texto na tabela texts
    const { data: newText, error: textError } = await supabase
      .from("texts")
      .insert([
        {
          user_id: partnerId,
          texto1: textos1,
          texto2: textos2,
          texto3: textos3,
        },
      ]);

    if (textError) {
      throw textError;
    }

    res.status(201).json({
      message: "Texto criado com sucesso!",
    });
  } catch (err) {
    console.error("Erro ao criar texto:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para excluir um texto
router.delete("/deleteText/:idText", async (req, res) => {
  const { idText } = req.params;

  try {
    // Em seguida, exclui a pergunta
    const { error: deleteTextError } = await supabase
      .from("texts")
      .delete()
      .eq("id", idText); // Filtra pela pergunta a ser excluída

    if (deleteTextError) {
      throw deleteTextError;
    }

    res.status(200).json({ message: "Texto excluído com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir texto:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// ------------------- Fim dos Endpoints de Frases ------------------- //

// Grava o resgate feito pelo usuário na tabela resgates
router.post("/insert-redemption/:userId", async (req, res) => {
  const { rewardId, pointsRequired } = req.body;
  const { userId } = req.params;

  try {
    // Log para depuração
    const { data: userData } = await supabase
      .from("profile_infos")
      .select("partner")
      .eq("id", userId)
      .single();

    const partnerId = userData.partner;

    const { data: partnerData } = await supabase
      .from("profile_infos")
      .select("*")
      .eq("id", partnerId)
      .single();

    const nameParner = partnerData.name;
    const emailPartner = partnerData.email;

    console.log("E-mail do destinatário:", emailPartner);

    // Verifica se o e-mail é válido
    if (
      !emailPartner ||
      typeof emailPartner !== "string" ||
      !emailPartner.includes("@")
    ) {
      return res
        .status(400)
        .json({ message: "E-mail do destinatário inválido!" });
    }

    // Buscando o nome do item
    const { data: storeData, error: storeError } = await supabase
      .from("store")
      .select("*")
      .eq("id", rewardId)
      .single();

    if (storeError) {
      throw storeError;
    }

    const imageUrl = storeData.image_url;
    const itemStore = storeData.name;

    // Inserir o resgate na tabela resgates
    const { error } = await supabase.from("resgates").insert([
      {
        user_id: userId,
        reward_id: rewardId,
        created_at: new Date(),
        pontos_qtd: pointsRequired,
        item_store: itemStore,
      },
    ]);

    if (error) {
      throw error;
    }

    const mailOptions = {
      from: process.env.EMAIL,
      to: emailPartner,
      subject: "Resgate na Loja!!",
      text: `O usuario ${nameParner} resgatou um item da loja: ${itemStore} e foram: ${pointsRequired} pontos`,
      html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #333; display: block;">Resgate na Loja!!</h2>
                    <span style="color: #666; font-size: 20pt; font display: block;">O usuário ${nameParner} resgatou um item da loja: ${itemStore} e foram: ${pointsRequired} pontos</span>
                    <img src="${imageUrl}" style="display: block; margin: 0 auto;" />
                </div>
            `,
    };

    // Log para depuração
    console.log("Mail Options:", mailOptions);

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Erro ao enviar e-mail:", err);
        return res.status(500).json({ message: "Erro ao enviar e-mail!" });
      } else {
        console.log("E-mail enviado:", info.response);
        return res.status(200).json({
          message: "Resgate registrado com sucesso e e-mail enviado!",
        });
      }
    });
  } catch (err) {
    console.error("Erro ao registrar resgate:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.post("/insert-redemption-test", async (req, res) => {
  const { rewardId, pointsRequired } = req.body;

  try {
    // Inserir o resgate na tabela resgates
    const { error } = await supabase.from("resgates").insert([
      {
        user_id: 999,
        reward_id: rewardId,
        created_at: new Date(),
        pontos_qtd: pointsRequired,
      },
    ]);

    if (error) {
      throw error;
    }

    res.status(200).json({ message: "Resgate registrado com sucesso!" });
  } catch (err) {
    console.error("Erro ao registrar resgate:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para upload de fotos
router.post("/upload", upload.single("photo"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: "Nenhum arquivo enviado" });
  }

  try {
    // Gerar um nome de arquivo único com base na data e hora
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.originalname}`;

    const { data, error } = await supabase.storage
      .from("fotos")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/fotos/${fileName}`;
    res.status(200).json({ message: "Foto enviada com sucesso!", fileUrl });
  } catch (err) {
    console.error("Erro ao fazer upload da foto:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.post("/foto_post", upload.single("photo"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: "Nenhum arquivo enviado" });
  }

  try {
    // Gerar um nome de arquivo único com base na data e hora
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.originalname}`;

    const { data, error } = await supabase.storage
      .from("posts")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/posts/${fileName}`;
    res.status(200).json({ message: "Foto enviada com sucesso!", fileUrl });
  } catch (err) {
    console.error("Erro ao fazer upload da foto:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.post("/foto_store", upload.single("photo"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: "Nenhum arquivo enviado" });
  }

  try {
    // Gerar um nome de arquivo único com base na data e hora
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.originalname}`;

    const { data, error } = await supabase.storage
      .from("store_images")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/store_images/${fileName}`;
    res.status(200).json({ message: "Foto enviada com sucesso!", fileUrl });
  } catch (err) {
    console.error("Erro ao fazer upload da foto:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.post("/upload_imagepic", upload.single("photo"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: "Nenhum arquivo enviado" });
  }

  try {
    // Gerar um nome de arquivo único com base na data e hora
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.originalname}`;

    const { data, error } = await supabase.storage
      .from("profile_pics")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/profile_pics/${fileName}`;
    res.status(200).json({ message: "Foto enviada com sucesso!", fileUrl });
  } catch (err) {
    console.error("Erro ao fazer upload da foto:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para buscar a quantidade de pontos de um usuário
router.get("/points/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: userPoints, error } = await supabase
      .from("user_points")
      .select("points")
      .eq("id", userId)
      .single(); // Obtém um único registro

    if (!userPoints) {
      return res.status(201).json({ message: "Usuário não encontrado" });
    }

    return res.status(200).json({ points: userPoints.points }); // Adicione um return aqui
  } catch (err) {
    console.error("Erro ao buscar pontos:", err);
    return res.status(500).json({ message: "Erro no servidor" }); // Adicione um return aqui também
  }
});

router.get("/points-test", async (req, res) => {
  try {
    const { data: userPoints, error } = await supabase
      .from("user_points_teste")
      .select("points")
      .eq("username", "teste")
      .single();

    if (error) {
      throw error;
    }

    if (!userPoints) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    res.status(200).json({ points: userPoints.points });
  } catch (err) {
    console.error("Erro ao buscar pontos:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para atualizar pontos do usuário após um minigame
router.post("/update-points/:userId", async (req, res) => {
  const { userId } = req.params;
  const { pointsEarned } = req.body;

  if (!userId || pointsEarned === undefined) {
    return res.status(400).json({ message: "Dados incompletos" });
  }

  try {
    // Obter os pontos atuais do usuário
    console.error("obtendo dados do user");
    const { data: userPoints, error: fetchError } = await supabase
      .from("user_points")
      .select("points")
      .eq("id", userId)
      .single();
    console.error("dados obtidos com user:", userId);

    if (fetchError || !userPoints) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Calcular novos pontos
    const newPoints = userPoints.points + pointsEarned;

    // Atualizar pontos do usuário
    console.error("tentando atualizar");
    const { error: updateError } = await supabase
      .from("user_points")
      .update({ points: newPoints, last_updated: new Date() })
      .eq("id", userId);

    console.error("Foi");

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({ message: "Pontos atualizados com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar pontos:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.post("/update-points-test", async (req, res) => {
  const { username, pointsEarned } = req.body;

  if (!username || pointsEarned === undefined) {
    return res.status(400).json({ message: "Dados incompletos" });
  }

  try {
    // Obter os pontos atuais do usuário
    const { data: userPoints, error: fetchError } = await supabase
      .from("user_points_teste")
      .select("points")
      .eq("username", username)
      .single();

    if (fetchError || !userPoints) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Calcular novos pontos
    const newPoints = userPoints.points + pointsEarned;

    // Atualizar pontos do usuário
    const { error: updateError } = await supabase
      .from("user_points_teste")
      .update({ points: newPoints })
      .eq("username", username);

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({ message: "Pontos atualizados com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar pontos:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para buscar perguntas e respostas aleatórias com base no partnerId
router.get("/questions/:partnerId", async (req, res) => {
  const { partnerId } = req.params;

  try {
    // Buscar 7 perguntas aleatórias usando a nova função RPC com partnerId
    const { data: questions, error: questionsError } = await supabase.rpc(
      "get_random_questions_by_partner",
      { p_limit: 7, p_partner_id: partnerId }
    );

    if (questionsError) {
      throw questionsError;
    }

    if (questions.length === 0) {
      return res.status(201).json({ message: "Nenhuma pergunta encontrada" });
    }

    // Buscar respostas para as perguntas selecionadas
    const questionIds = questions.map((question) => question.id);
    const { data: answers, error: answersError } = await supabase
      .from("respostas")
      .select("id, pergunta_id, resposta, is_correta") // Selecionar campos explicitamente
      .in("pergunta_id", questionIds); // Filtra as respostas pelas perguntas selecionadas

    if (answersError) {
      throw answersError;
    }

    // Organizar as respostas por pergunta
    const questionsWithAnswers = questions.map((question) => ({
      ...question,
      answers: answers.filter((answer) => answer.pergunta_id === question.id),
    }));

    res.status(200).json(questionsWithAnswers);
  } catch (err) {
    console.error("Erro ao buscar perguntas e respostas:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para buscar perguntas e respostas com id da pergunta
router.get("/questionSingle/:idPergunta", async (req, res) => {
  const { idPergunta } = req.params;
  try {
    // Buscar a pergunta com o id fornecido
    const { data: question, error: questionError } = await supabase
      .from("perguntas")
      .select("*") // Qualificar colunas explicitamente
      .eq("id", idPergunta)
      .single(); // Para garantir que apenas uma pergunta seja retornada

    if (questionError) {
      throw questionError;
    }

    if (!question) {
      return res.status(404).json({ message: "Pergunta não encontrada" });
    }

    // Buscar respostas para a pergunta selecionada
    const { data: answers, error: answersError } = await supabase
      .from("respostas")
      .select("id, pergunta_id, resposta, is_correta") // Qualificar colunas explicitamente
      .eq("pergunta_id", idPergunta); // Filtra as respostas pela pergunta selecionada

    if (answersError) {
      throw answersError;
    }

    // Retornar a pergunta e suas respostas
    res.status(200).json({
      question,
      answers,
    });
  } catch (err) {
    console.error("Erro ao buscar pergunta e respostas:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para editar uma pergunta e suas respostas
router.post("/editQuestion/:idPergunta", async (req, res) => {
  const { idPergunta } = req.params;
  const { pergunta, indiceCorreta, respostas } = req.body; // Captura a pergunta, o índice da resposta correta e as respostas

  // Verifique se o índice da resposta correta está entre 1 e 4
  if (indiceCorreta < 1 || indiceCorreta > 4) {
    return res.status(400).json({
      message: "O índice da resposta correta deve estar entre 1 e 4.",
    });
  }

  try {
    // Atualiza a pergunta
    const { error: updateQuestionError } = await supabase
      .from("perguntas")
      .update({ pergunta, resposta_correta: indiceCorreta }) // Atualiza a pergunta com o novo valor
      .eq("id", idPergunta); // Filtra pela pergunta que deve ser atualizada

    if (updateQuestionError) {
      throw updateQuestionError;
    }

    // Atualiza as respostas
    for (const resposta of respostas) {
      const { id, resposta: respostaTexto } = resposta;

      // Verifica se a resposta atual deve ser marcada como correta
      const isCorreta =
        respostas.findIndex((r) => r.id === id) === indiceCorreta - 1; // Ajusta o índice para 0-3

      const { error: updateAnswerError } = await supabase
        .from("respostas")
        .update({
          resposta: respostaTexto,
          is_correta: isCorreta, // Define se a resposta é correta com base na lógica
        })
        .eq("id", id); // Filtra pela ID da resposta que deve ser atualizada

      if (updateAnswerError) {
        throw updateAnswerError;
      }
    }

    res
      .status(200)
      .json({ message: "Pergunta e respostas atualizadas com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar pergunta e respostas:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para criar perguntas e respostas
router.post("/createQuestion", async (req, res) => {
  const { pergunta, indiceCorreta, partnerId, respostas } = req.body;

  try {
    // Inserir a nova pergunta na tabela perguntas
    const { data: newQuestion, error: questionError } = await supabase
      .from("perguntas")
      .insert([
        {
          pergunta: pergunta,
          resposta_correta: indiceCorreta, // O ID da resposta correta
          partner_id: partnerId,
        },
      ])
      .select("*")
      .single(); // Obtém a nova pergunta inserida

    if (questionError) {
      throw questionError;
    }

    // Verifique se a resposta correta existe dentro das respostas fornecidas
    const respostaCorreta = respostas.find(
      (resposta) => resposta.id === indiceCorreta
    );
    if (!respostaCorreta) {
      return res.status(400).json({
        message:
          "A resposta correta fornecida não está presente nas respostas enviadas.",
      });
    }

    // Inserir as respostas na tabela respostas
    const respostasData = respostas.map((resposta) => ({
      pergunta_id: newQuestion.id, // Referencia o ID da nova pergunta
      resposta: resposta.texto, // Supondo que cada resposta tem um campo 'texto'
      is_correta: resposta.id === indiceCorreta, // Verifica se a resposta é a correta pelo id
    }));

    const { error: answersError } = await supabase
      .from("respostas")
      .insert(respostasData);

    if (answersError) {
      throw answersError;
    }

    res.status(201).json({
      message: "Pergunta e respostas criadas com sucesso!",
      question: newQuestion,
      respostas: respostasData,
    });
  } catch (err) {
    console.error("Erro ao criar pergunta e respostas:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para excluir uma pergunta e suas respostas
router.delete("/deleteQuestion/:idPergunta", async (req, res) => {
  const { idPergunta } = req.params;

  try {
    // Primeiro, exclui as respostas associadas à pergunta
    const { error: deleteAnswersError } = await supabase
      .from("respostas")
      .delete()
      .eq("pergunta_id", idPergunta); // Filtra as respostas pela pergunta

    if (deleteAnswersError) {
      throw deleteAnswersError;
    }

    // Em seguida, exclui a pergunta
    const { error: deleteQuestionError } = await supabase
      .from("perguntas")
      .delete()
      .eq("id", idPergunta); // Filtra pela pergunta a ser excluída

    if (deleteQuestionError) {
      throw deleteQuestionError;
    }

    res
      .status(200)
      .json({ message: "Pergunta e respostas excluídas com sucesso!" });
  } catch (err) {
    console.error("Erro ao excluir pergunta e respostas:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para buscar perguntas e respostas TODAS
router.get("/questionsAll/:partnerId", async (req, res) => {
  const { partnerId } = req.params;
  try {
    const { data: questions, error: questionsError } = await supabase
      .from("perguntas")
      .select("*") // Qualificar colunas explicitamente
      .eq("partner_id", partnerId); // Filtra as respostas pelas perguntas selecionadas

    if (questionsError) {
      throw questionsError;
    }

    // Se não houver perguntas, retorna um array vazio ao invés de um erro 404
    if (!questions || questions.length === 0) {
      return res.status(203).json([]); // Retorna um array vazio
    }

    res.status(200).json(questions);
  } catch (err) {
    console.error("Erro ao buscar perguntas e respostas:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para verificar o status do quiz
router.get("/quiz-status/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from("status_quiz")
      .select("is_completed")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({ is_completed: data.is_completed });
  } catch (err) {
    console.error("Erro ao verificar status do quiz:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.get("/quiz-status-test", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("status_quiz-teste")
      .select("is_completed")
      .eq("id", 1)
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({ is_completed: data.is_completed });
  } catch (err) {
    console.error("Erro ao verificar status do quiz:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para atualizar o status do quiz
router.post("/update-quiz-status/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { error } = await supabase
      .from("status_quiz")
      .update({
        data_ultimo_quiz: new Date(),
        is_completed: true,
      })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    res.status(200).json({ message: "Status do quiz atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar status do quiz:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.post("/update-quiz-status-test", async (req, res) => {
  try {
    const { error } = await supabase
      .from("status_quiz-teste")
      .update({
        data_ultimo_quiz: new Date(),
        is_completed: true,
      })
      .eq("id", 1);

    if (error) {
      throw error;
    }

    res.status(200).json({ message: "Status do quiz atualizado com sucesso!" });
  } catch (err) {
    console.error("Erro ao atualizar status do quiz:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para listar todos os itens da loja
router.get("/items/:partnerId", async (req, res) => {
  const { partnerId } = req.params;
  //partnerId é do usuario que criou o item pra você
  try {
    const { data: items, error } = await supabase
      .from("store")
      .select("*")
      .eq("id_partner_view", partnerId)
      .order("id", { ascending: true });

    if (error) {
      throw error;
    }

    res.status(200).json(items);
  } catch (err) {
    console.error("Erro ao listar itens:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para listar todos os itens da loja
router.post("/create_item/:partnerId", async (req, res) => {
  const { title_item, desc_item, points, image_url } = req.body;
  const { partnerId } = req.params;

  if (!title_item) {
    return res.status(400).json({ error: "Titulo do item é necessário." });
  }

  if (!desc_item) {
    return res.status(400).json({ error: "Descrição do item é necessária." });
  }

  if (!points) {
    return res.status(400).json({ error: "Pontos são necessários." });
  }

  if (!image_url) {
    return res.status(400).json({ error: "Imagem do item é necessária." });
  }

  if (!partnerId) {
    return res.status(400).json({ error: "partnerId é necessário." });
  }

  try {
    const { data, error } = await supabase.from("store").insert([
      {
        name: title_item,
        description: desc_item,
        points_required: points,
        image_url: image_url,
        id_partner_view: partnerId,
      },
    ]);

    if (error) {
      throw error;
    }

    res.status(201).json({ message: "Item criado com sucesso!", data });
  } catch (err) {
    console.error("Erro ao criar item:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para atualizar um item da loja
router.post("/update_item/:itemId", async (req, res) => {
  const { itemName, itemDesc, itemPoints } = req.body;
  const { itemId } = req.params;

  try {
    // Atualizando o item com o itemId fornecido
    const { data, error } = await supabase
      .from("store")
      .update({
        name: itemName,
        description: itemDesc,
        points_required: itemPoints,
      })
      .eq("id", itemId); // Filtra pelo itemId

    if (error) {
      throw error; // Lança um erro se houver
    }

    // Se não houver erro, retorna os dados da exclusão
    res.status(200).json({ message: "Item atualizado com sucesso!", data });
  } catch (err) {
    console.error("Erro ao excluir item:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para excluir um item da loja
router.delete("/delete_item/:itemId", async (req, res) => {
  const { itemId } = req.params;

  try {
    // Excluindo o item com o itemId fornecido
    const { data, error } = await supabase
      .from("store")
      .delete()
      .eq("id", itemId); // Filtra pelo itemId

    if (error) {
      throw error; // Lança um erro se houver
    }

    // Se não houver erro, retorna os dados da exclusão
    res.status(200).json({ message: "Item excluído com sucesso!", data });
  } catch (err) {
    console.error("Erro ao excluir item:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

//Posts com comentarios
router.get("/posts/:userId/:partnerId", async (req, res) => {
  const { userId, partnerId } = req.params;
  try {
    // Capturar query params: page, limit, search, sortBy, userId, partnerId
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "data"; // Ordena por data de criação por padrão

    if (!userId || !partnerId) {
      return res
        .status(400)
        .json({ message: "Parâmetros userId e partnerId são obrigatórios" });
    }

    // Buscar os nomes correspondentes aos userId e partnerId na tabela profile_infos
    const { data: profiles, error: profileError } = await supabase
      .from("profile_infos")
      .select("name")
      .in("id", [userId, partnerId]); // Filtrar por userId e partnerId

    if (profileError) {
      throw profileError;
    }

    if (profiles.length !== 2) {
      return res.status(404).json({ message: "Usuários não encontrados" });
    }

    // Extrair os nomes para filtrar os posts
    const usernamesToFilter = profiles.map((profile) => profile.name);

    // Fazer a busca na tabela de 'posts' com paginação, filtros e ordenação, e filtrar pelos usernames
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("*") // Selecione apenas os campos necessários
      .in("username", usernamesToFilter) // Filtrar posts pelos usernames correspondentes
      .order(sortBy, { ascending: false }) // Ordena os resultados
      .range(offset, offset + limit - 1); // Paginação

    if (postsError) {
      throw postsError;
    }

    // Contagem total de posts para controle de páginas no frontend
    const { count } = await supabase
      .from("posts")
      .select("id", { count: "exact" })
      .in("username", usernamesToFilter); // Filtrar a contagem pelos mesmos usernames

    // Log para verificar os posts retornados
    console.log("Posts:", posts);

    // Buscando comentários para os posts encontrados
    const postIds = posts.map((post) => post.id); // Obter os IDs dos posts
    const { data: comments, error: commentsError } = await supabase
      .from("comments")
      .select("id_post, comment_text, username") // Selecionar 'id_post', 'comment_text' e 'username'
      .in("id_post", postIds); // Busca os comentários onde 'id_post' está na lista de IDs de posts

    if (commentsError) {
      throw commentsError;
    }

    // Log para verificar os comentários retornados
    console.log("Comentários:", comments);

    // Agrupar os comentários por id_post e incluir o username
    const commentsByPostId = comments.reduce((acc, comment) => {
      const postId = comment.id_post;
      if (!acc[postId]) {
        acc[postId] = [];
      }
      // Adiciona o texto do comentário e o username
      acc[postId].push({
        comment_text: comment.comment_text,
        username: comment.username,
      });
      return acc;
    }, {});

    // Adicionar os comentários e usernames aos respectivos posts
    const postsWithComments = posts.map((post) => ({
      ...post,
      comments: commentsByPostId[post.id] || [], // Adiciona os comentários (com usernames) ou uma lista vazia se não houver
    }));

    // Log para depuração
    console.log("Posts com Comentários e Usernames:", postsWithComments);

    // Retornar os dados paginados e a contagem total
    res.status(200).json({
      posts: postsWithComments,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalPosts: count,
    });
  } catch (err) {
    console.error("Erro ao buscar posts:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.get("/post/:id", async (req, res) => {
  try {
    // Capturar o id do post a partir dos parâmetros da rota
    const postId = req.params.id;

    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }

    // Buscar o post com o id fornecido
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId) // Filtra pelo id do post
      .single(); // Retorna um único post

    if (postError) {
      throw postError;
    }

    // Se o post não for encontrado
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Buscar os comentários associados ao post
    const { data: comments, error: commentsError } = await supabase
      .from("comments")
      .select("id_post, comment_text, username")
      .eq("id_post", postId); // Filtra os comentários pelo id do post

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
    console.error("Erro ao buscar o post:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.post("/upload_post", async (req, res) => {
  const { nome_foto, desc_foto, username } = req.body;

  if (!nome_foto) {
    return res.status(400).json({ error: "Nome da foto é necessário." });
  }

  if (!username) {
    return res.status(400).json({ error: "Username é necessário." });
  }

  try {
    const now = new Date();
    now.setHours(now.getHours() - 3); // Subtrai 3 horas
    const adjustedDate = now.toISOString();

    const { data, error } = await supabase.from("posts").insert([
      {
        data: adjustedDate,
        username: username,
        nome_foto: nome_foto,
        desc_foto: desc_foto,
        is_liked: false,
      },
    ]);

    if (error) {
      throw error;
    }

    res.status(201).json({ message: "Post criado com sucesso!", data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/update-profile/:userId", async (req, res) => {
  const { name, email, phone, profileImage } = req.body;
  const { userId } = req.params;

  // Verifica se todos os campos necessários estão presentes
  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Todos os campos são necessários." });
  }

  try {
    // Verifica se existe uma linha na tabela profile_infos com o userId especificado
    const { data: existingProfile, error: profileError } = await supabase
      .from("profile_infos")
      .select("id")
      .eq("id", userId)
      .single();

    // Se houver erro na consulta ou nenhum perfil for encontrado, inserimos um novo
    if (profileError || !existingProfile) {
      // Insere um novo perfil na tabela profile_infos
      const { data: newProfile, error: insertError } = await supabase
        .from("profile_infos")
        .insert([
          { id: userId, name, email, phone, profile_image: profileImage },
        ]);

      if (insertError) {
        throw insertError;
      }

      // Inserir informações na tabela user_points com o userId
      const { error: pointsError } = await supabase
        .from("user_points")
        .insert([
          { id: userId, username: name, points: 0, last_updated: new Date() },
        ]); // Inicializa os pontos com 0 ou outro valor padrão

      if (pointsError) {
        throw pointsError;
      }

      // Inserir informações na tabela status_quiz com o userId
      const { error: quizError } = await supabase.from("status_quiz").insert([
        {
          id: userId,
          username: name,
          data_ultimo_quiz: new Date(),
          is_completed: false,
        },
      ]); // Define o status inicial do quiz

      if (quizError) {
        throw quizError;
      }

      return res
        .status(201)
        .json({ message: "Perfil criado com sucesso!", data: newProfile });
    }

    // Se o perfil já existir, atualiza os dados na tabela profile_infos
    const { data, error } = await supabase
      .from("profile_infos")
      .update({ name, email, phone, profile_image: profileImage })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    res.status(200).json({ message: "Perfil atualizado com sucesso!", data });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

//Pega informações adicionais do usuário pelo userId.
router.get("/get-profile/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Busca os dados na tabela profile_infos com base no userId
    const { data: profileData, error: profileError } = await supabase
      .from("profile_infos")
      .select("*")
      .eq("id", userId)
      .single();

    // Se não houver dados na tabela profile_infos ou ocorrer um erro, busca o email na tabela users
    if (!profileData || profileError) {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("email")
        .eq("id", userId)
        .single();

      // Se houver erro ao buscar na tabela users, retorna erro ao cliente
      if (userError) {
        return res
          .status(500)
          .json({ message: "Erro ao buscar email do usuário" });
      }

      // Se encontrar o email, retorna o email
      if (userData) {
        return res.status(201).json({ email: userData.email });
      }

      // Caso não encontre o userId na tabela users
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    // Se encontrou dados na tabela profile_infos, retorna esses dados
    res.status(200).json(profileData);
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Pega informações do perfil através do userName
router.get("/get_profile_username/:userName", async (req, res) => {
  const { userName } = req.params;

  try {
    // Busca os dados na tabela profile_infos com base no userName
    const { data, error } = await supabase
      .from("profile_infos")
      .select("*")
      .eq("name", userName);

    if (error) {
      throw error;
    }

    // Verifica se nenhum dado foi retornado
    if (!data || data.length === 0) {
      return res.status(202).json({ message: "Usuário não encontrado." });
    }

    // Como estamos esperando um único perfil, pegue o primeiro item do array
    const profile = data[0];

    res.status(200).json(profile);
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

router.post("/like", async (req, res) => {
  try {
    // Capturar o corpo da requisição: likedPostIds
    const { likedPostIds } = req.body;

    if (!Array.isArray(likedPostIds) || likedPostIds.length === 0) {
      return res.status(400).json({ message: "Invalid data" });
    }

    // Atualizar o campo 'is_liked' dos posts na tabela
    const { data, error } = await supabase
      .from("posts")
      .update({ is_liked: true })
      .in("id", likedPostIds);

    if (error) {
      throw error;
    }

    // Retornar sucesso
    res
      .status(200)
      .json({ message: "Likes updated successfully", updatedPosts: data });
  } catch (err) {
    console.error("Erro ao atualizar likes:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

// Endpoint para adicionar um comentário
router.post("/comment/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    // Capturar o corpo da requisição: id_post e comment_text
    const { id_post, comment_text } = req.body;

    if (!id_post || !comment_text || typeof comment_text !== "string") {
      return res.status(400).json({ message: "Invalid data" });
    }

    const now = new Date();
    now.setHours(now.getHours() - 3); // Subtrai 3 horas
    const adjustedDate = now.toISOString();

    const { data: userData, error: userError } = await supabase
      .from("profile_infos")
      .select("name")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const userName = userData.name;

    // Inserir o novo comentário na tabela 'comments'
    const { data, error } = await supabase.from("comments").insert([
      {
        id_post: id_post,
        comment_text: comment_text,
        created_at: adjustedDate,
        username: userName,
        // Você pode adicionar mais campos aqui, como a data do comentário, se necessário
      },
    ]);

    if (error) {
      throw error;
    }

    // Verifica se `data` contém pelo menos um item
    if (data && data.length > 0) {
      // Retornar sucesso
      res
        .status(200)
        .json({ message: "Comment added successfully", comment: data[0] });
    } else {
      // Caso `data` esteja vazio
      res.status(200).json({ message: "comentario vazio" });
    }
  } catch (err) {
    console.error("Erro ao adicionar comentário:", err);
    res.status(500).json({ message: "Erro no servidor" });
  }
});

module.exports = router;
