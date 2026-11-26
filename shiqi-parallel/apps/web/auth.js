(() => {
  const cfg = window.SHIQI_CONFIG;
  const toast = document.getElementById("toast");
  const authDialog = document.getElementById("authDialog");
  const communityDialog = document.getElementById("communityDialog");
  if (!window.supabase || !cfg?.SUPABASE_URL || !cfg?.SUPABASE_PUBLISHABLE_KEY) {
    toast.textContent = "Não foi possível iniciar a conexão com a SHIQI.";
    toast.classList.add("show");
    return;
  }

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  let currentSession = null;
  let mode = "signin";
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
  function setMode(next) {
    mode = next;
    const signup = mode === "signup";
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
    const authButton = document.getElementById("authButton");
    authButton.textContent = signedIn ? "Sair" : "Entrar";
    const emailName = session?.user?.email?.split("@")[0] || "Visitante";
    const display = session?.user?.user_metadata?.display_name || emailName;
    document.getElementById("profileName").textContent = signedIn ? display : "Visitante";
    document.getElementById("profileStatus").textContent = signedIn ? session.user.email : "Entre para começar";
    document.querySelector(".avatar").textContent = signedIn ? display.slice(0,1).toUpperCase() : "S";
    document.getElementById("communityList").innerHTML = signedIn
      ? '<p class="empty-state">Carregando suas comunidades...</p>'
      : '<p class="empty-state">Entre na SHIQI para ver suas comunidades.</p>';
    if (signedIn) loadCommunities();
  }
  async function loadCommunities() {
    const { data, error } = await client.from("communities")
      .select("id,name,slug,description,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      document.getElementById("communityList").innerHTML = '<p class="empty-state">Não foi possível carregar as comunidades.</p>';
      console.error(error);
      return;
    }
    const list = document.getElementById("communityList");
    if (!data.length) {
      list.innerHTML = '<p class="empty-state">Você ainda não participa de comunidades. Crie a primeira!</p>';
      return;
    }
    list.innerHTML = data.map(item => (
      '<article class="community-tile"><div class="community-mark">' +
      item.name.slice(0,1).toUpperCase() +
      '</div><div><strong></strong><span></span></div></article>'
    )).join("");
    [...list.querySelectorAll(".community-tile")].forEach((el, i) => {
      el.querySelector("strong").textContent = data[i].name;
      el.querySelector("span").textContent = data[i].description || "Sua comunidade SHIQI";
    });
  }

  document.getElementById("authButton").addEventListener("click", async () => {
    if (!currentSession) {
      setMode("signin");
      openDialog(authDialog);
      return;
    }
    const { error } = await client.auth.signOut();
    if (error) notify(error.message, true);
    else notify("Você saiu da sua conta.");
  });
  document.getElementById("authModeButton").addEventListener("click", () => setMode(mode === "signin" ? "signup" : "signin"));
  document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const display_name = document.getElementById("displayName").value.trim();
    const username = document.getElementById("username").value.trim();
    const submit = document.getElementById("authSubmit");
    submit.disabled = true;
    setMessage("authMessage", mode === "signup" ? "Criando sua conta..." : "Entrando...");
    let result;
    if (mode === "signup") {
      result = await client.auth.signUp({
        email, password,
        options: { data: { display_name, username: username || null } }
      });
    } else {
      result = await client.auth.signInWithPassword({ email, password });
    }
    submit.disabled = false;
    if (result.error) {
      setMessage("authMessage", result.error.message, true);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("authMessage", "Conta criada! Confira seu e-mail para confirmar o cadastro antes de entrar.");
      return;
    }
    authDialog.close();
    document.getElementById("authForm").reset();
    notify(mode === "signup" ? "Conta criada. Bem-vindo à SHIQI!" : "Login realizado com sucesso.");
  });

  document.getElementById("createCommunityButton").addEventListener("click", () => {
    if (!currentSession) {
      setMode("signin");
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
    const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    setMessage("communityMessage", "Criando comunidade...");
    const { data, error } = await client.from("communities")
      .insert({ name, slug: slug.length >= 3 ? slug : "comunidade-" + Date.now().toString().slice(-8), description, owner_id: currentSession.user.id })
      .select("id")
      .single();
    if (error) {
      setMessage("communityMessage", error.message, true);
      submit.disabled = false;
      return;
    }
    const { error: channelError } = await client.from("channels").insert({
      community_id: data.id, name: "geral", description: "Conversa geral", channel_type: "text", position: 0
    });
    submit.disabled = false;
    communityDialog.close();
    event.currentTarget.reset();
    await loadCommunities();
    notify(channelError ? "Comunidade criada! Não foi possível criar o canal inicial." : "Comunidade criada com o canal #geral!");
  });

  document.getElementById("startConversationButton").addEventListener("click", () => {
    if (!currentSession) {
      setMode("signin"); openDialog(authDialog);
      notify("Entre na sua conta para começar.");
    } else notify("Mensagens diretas serão a próxima etapa.");
  });
  document.getElementById("editProfileButton").addEventListener("click", () => {
    if (!currentSession) { setMode("signin"); openDialog(authDialog); }
    else notify("A edição de perfil será adicionada na próxima etapa.");
  });
  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => document.getElementById(button.dataset.close).close());
  });
  authDialog.addEventListener("click", event => { if (event.target === authDialog) authDialog.close(); });
  communityDialog.addEventListener("click", event => { if (event.target === communityDialog) communityDialog.close(); });

  client.auth.onAuthStateChange((_event, session) => renderSession(session));
  client.auth.getSession().then(({ data }) => renderSession(data.session));
})();
