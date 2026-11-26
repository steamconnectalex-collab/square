(() => {
  const config = window.SHIQI_CONFIG;
  const toast = document.getElementById("toast");
  const authDialog = document.getElementById("authDialog");
  const communityDialog = document.getElementById("communityDialog");
  if (!window.supabase || !config?.SUPABASE_URL || !config?.SUPABASE_PUBLISHABLE_KEY) {
    toast.textContent = "Não foi possível iniciar a conexão com a SHIQI.";
    toast.classList.add("show");
    return;
  }

  const client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
  let currentSession = null;
  let authMode = "signin";
  let activeChannelId = null;
  let activeRealtimeChannel = null;
  let toastTimer;

  function notify(message, error = false) {
    toast.textContent = message;
    toast.classList.toggle("error", error);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show", "error"), 3600);
  }
  function setMessage(id, message, error = false) {
    const el = document.getElementById(id);
    el.textContent = message;
    el.classList.toggle("error", error);
  }
  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }
  function setAuthMode(next) {
    authMode = next;
    const signup = authMode === "signup";
    document.getElementById("authTitle").textContent = signup ? "Crie sua conta" : "Entre no seu espaço";
    document.getElementById("authIntro").textContent = signup ? "Sua comunidade começa com uma conta SHIQI." : "Acesse sua conta para continuar.";
    document.getElementById("authSubmit").textContent = signup ? "Criar minha conta" : "Entrar";
    document.getElementById("authSwitchText").textContent = signup ? "Já tem uma conta?" : "Ainda não tem conta?";
    document.getElementById("authModeButton").textContent = signup ? "Entrar" : "Criar conta";
    document.getElementById("displayNameField").hidden = !signup;
    document.getElementById("usernameField").hidden = !signup;
    document.getElementById("password").autocomplete = signup ? "new-password" : "current-password";
    setMessage("authMessage", "");
  }
  function renderSession(session) {
    currentSession = session;
    const signedIn = !!session?.user;
    const nameFromEmail = session?.user?.email?.split("@")[0] || "Visitante";
    const displayName = session?.user?.user_metadata?.display_name || nameFromEmail;
    document.getElementById("authButton").textContent = signedIn ? "Sair" : "Entrar";
    document.getElementById("profileName").textContent = signedIn ? displayName : "Visitante";
    document.getElementById("profileStatus").textContent = signedIn ? session.user.email : "Entre para começar";
    document.querySelector(".avatar").textContent = signedIn ? displayName.slice(0, 1).toUpperCase() : "S";
    if (signedIn) loadCommunities();
    else {
      document.getElementById("communityList").innerHTML = '<p class="empty-state">Entre na SHIQI para ver suas comunidades.</p>';
      document.getElementById("chatSection").hidden = true;
      clearActiveRealtime();
    }
  }
  async function clearActiveRealtime() {
    if (activeRealtimeChannel) {
      await client.removeChannel(activeRealtimeChannel);
      activeRealtimeChannel = null;
    }
    activeChannelId = null;
  }

  async function loadCommunities() {
    const { data, error } = await client.from("communities")
      .select("id,name,slug,description,created_at")
      .order("created_at", { ascending: false });
    const list = document.getElementById("communityList");
    if (error) {
      list.innerHTML = '<p class="empty-state">Não foi possível carregar as comunidades.</p>';
      console.error(error);
      return;
    }
    list.replaceChildren();
    if (!data.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Você ainda não participa de comunidades. Crie a primeira!";
      list.append(empty);
      return;
    }
    data.forEach(community => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "community-tile community-tile-button";
      const mark = document.createElement("div");
      mark.className = "community-mark";
      mark.textContent = community.name.slice(0, 1).toUpperCase();
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = community.name;
      const description = document.createElement("span");
      description.textContent = community.description || "Sua comunidade SHIQI";
      copy.append(title, description);
      button.append(mark, copy);
      button.addEventListener("click", () => openCommunity(community));
      list.append(button);
    });
  }

  async function openCommunity(community) {
    await clearActiveRealtime();
    document.getElementById("chatSection").hidden = false;
    document.getElementById("chatCommunityName").textContent = community.name;
    document.getElementById("channelList").innerHTML = '<p class="empty-state">Carregando canais...</p>';
    document.getElementById("activeChannelName").textContent = "Selecione um canal";
    document.getElementById("activeChannelDescription").textContent = "Suas conversas aparecem aqui.";
    document.getElementById("messagesList").innerHTML = '<p class="empty-state">Escolha um canal para abrir a conversa.</p>';
    document.getElementById("messageInput").disabled = true;
    document.querySelector("#messageForm button").disabled = true;
    const { data, error } = await client.from("channels")
      .select("id,name,description,channel_type")
      .eq("community_id", community.id)
      .order("position", { ascending: true });
    const list = document.getElementById("channelList");
    if (error) {
      list.innerHTML = '<p class="empty-state">Não foi possível carregar os canais.</p>';
      console.error(error);
      return;
    }
    list.replaceChildren();
    if (!data.length) {
      list.innerHTML = '<p class="empty-state">Esta comunidade ainda não tem canais.</p>';
      return;
    }
    data.forEach(channel => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "channel-item";
      const hash = document.createElement("span");
      hash.textContent = "#";
      const title = document.createElement("strong");
      title.textContent = channel.name;
      button.append(hash, title);
      button.addEventListener("click", () => openChannel(channel, button));
      list.append(button);
    });
    list.querySelector(".channel-item")?.click();
  }

  async function openChannel(channel, button) {
    await clearActiveRealtime();
    activeChannelId = channel.id;
    document.querySelectorAll(".channel-item").forEach(item => item.classList.toggle("selected", item === button));
    document.getElementById("activeChannelName").textContent = "# " + channel.name;
    document.getElementById("activeChannelDescription").textContent = channel.description || "Conversa da comunidade";
    document.getElementById("messageInput").disabled = false;
    document.querySelector("#messageForm button").disabled = false;
    await loadMessages();
    activeRealtimeChannel = client.channel("shiqi-messages-" + channel.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "messages",
        filter: "channel_id=eq." + channel.id
      }, () => loadMessages())
      .subscribe();
  }

  async function loadMessages() {
    if (!activeChannelId) return;
    const requestedChannel = activeChannelId;
    const list = document.getElementById("messagesList");
    const { data, error } = await client.from("messages")
      .select("id,content,author_id,created_at")
      .eq("channel_id", requestedChannel)
      .order("created_at", { ascending: true })
      .limit(100);
    if (requestedChannel !== activeChannelId) return;
    if (error) {
      list.innerHTML = '<p class="empty-state">Não foi possível carregar as mensagens.</p>';
      console.error(error);
      return;
    }
    list.replaceChildren();
    if (!data.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Este canal está vazio. Envie a primeira mensagem!";
      list.append(empty);
      return;
    }
    const authorIds = [...new Set(data.map(message => message.author_id))];
    const { data: profiles } = await client.from("profiles")
      .select("id,display_name,username")
      .in("id", authorIds);
    const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
    data.forEach(message => {
      const profile = profileMap.get(message.author_id);
      const author = profile?.display_name || profile?.username || "Membro";
      const article = document.createElement("article");
      article.className = "message-item";
      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = author.slice(0, 1).toUpperCase();
      const body = document.createElement("div");
      body.className = "message-body";
      const meta = document.createElement("div");
      meta.className = "message-meta";
      const authorEl = document.createElement("strong");
      authorEl.textContent = author;
      const time = document.createElement("time");
      time.textContent = new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const content = document.createElement("p");
      content.textContent = message.content;
      meta.append(authorEl, time);
      body.append(meta, content);
      article.append(avatar, body);
      list.append(article);
    });
    list.scrollTop = list.scrollHeight;
  }

  document.getElementById("messageForm").addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById("messageInput");
    const content = input.value.trim();
    if (!content || !activeChannelId || !currentSession?.user) return;
    const sendButton = event.currentTarget.querySelector("button");
    sendButton.disabled = true;
    const { error } = await client.from("messages").insert({
      channel_id: activeChannelId,
      author_id: currentSession.user.id,
      content
    });
    sendButton.disabled = false;
    if (error) {
      notify("Não foi possível enviar: " + error.message, true);
      return;
    }
    input.value = "";
  });

  document.getElementById("authButton").addEventListener("click", async () => {
    if (!currentSession) {
      setAuthMode("signin");
      openDialog(authDialog);
      return;
    }
    const { error } = await client.auth.signOut();
    if (error) notify(error.message, true);
    else notify("Você saiu da sua conta.");
  });

  document.getElementById("authModeButton").addEventListener("click", () => {
    setAuthMode(authMode === "signin" ? "signup" : "signin");
  });

  document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const display_name = document.getElementById("displayName").value.trim();
    const username = document.getElementById("username").value.trim();
    const submit = document.getElementById("authSubmit");
    submit.disabled = true;
    setMessage("authMessage", authMode === "signup" ? "Criando sua conta..." : "Entrando...");
    const result = authMode === "signup"
      ? await client.auth.signUp({ email, password, options: { data: { display_name, username: username || null } } })
      : await client.auth.signInWithPassword({ email, password });
    submit.disabled = false;
    if (result.error) {
      setMessage("authMessage", result.error.message, true);
      return;
    }
    if (authMode === "signup" && !result.data.session) {
      setMessage("authMessage", "Conta criada! Confira seu e-mail para confirmar o cadastro antes de entrar.");
      return;
    }
    authDialog.close();
    event.currentTarget.reset();
    notify(authMode === "signup" ? "Conta criada. Bem-vindo à SHIQI!" : "Login realizado com sucesso.");
  });

  document.getElementById("createCommunityButton").addEventListener("click", () => {
    if (!currentSession) {
      setAuthMode("signin");
      openDialog(authDialog);
      notify("Entre na sua conta para criar uma comunidade.");
      return;
    }
    setMessage("communityMessage", "");
    openDialog(communityDialog);
  });

  document.getElementById("communityForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentSession?.user) return;
    const name = document.getElementById("communityName").value.trim();
    const description = document.getElementById("communityDescription").value.trim();
    const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    setMessage("communityMessage", "Criando comunidade...");
    const { data, error } = await client.from("communities")
      .insert({
        name,
        slug: slug.length >= 3 ? slug : "comunidade-" + Date.now().toString().slice(-8),
        description,
        owner_id: currentSession.user.id
      })
      .select("id")
      .single();
    if (error) {
      setMessage("communityMessage", error.message, true);
      submit.disabled = false;
      return;
    }
    const { error: channelError } = await client.from("channels").insert({
      community_id: data.id,
      name: "geral",
      description: "Conversa geral",
      channel_type: "text",
      position: 0
    });
    submit.disabled = false;
    communityDialog.close();
    event.currentTarget.reset();
    await loadCommunities();
    notify(channelError ? "Comunidade criada! Não foi possível criar o canal inicial." : "Comunidade criada com o canal #geral!");
  });

  document.getElementById("startConversationButton").addEventListener("click", () => {
    if (!currentSession) {
      setAuthMode("signin");
      openDialog(authDialog);
      notify("Entre na sua conta para começar.");
    } else notify("Mensagens diretas serão a próxima etapa.");
  });
  document.getElementById("editProfileButton").addEventListener("click", () => {
    if (!currentSession) {
      setAuthMode("signin");
      openDialog(authDialog);
    } else notify("A edição de perfil será adicionada na próxima etapa.");
  });

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => document.getElementById(button.dataset.close).close());
  });
  authDialog.addEventListener("click", event => { if (event.target === authDialog) authDialog.close(); });
  communityDialog.addEventListener("click", event => { if (event.target === communityDialog) communityDialog.close(); });

  client.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => renderSession(session), 0);
  });
  client.auth.getSession().then(({ data }) => renderSession(data.session));
})();