(() => {
  const toast = document.getElementById("toast");
  let toastTimer;
  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }
  document.getElementById("exploreButton")?.addEventListener("click", () => {
    notify("Esta é a primeira prévia da SHIQI. As funções serão conectadas nas próximas etapas.");
  });
  document.getElementById("helpButton")?.addEventListener("click", () => {
    notify("Prévia de desenvolvimento — ainda sem suporte conectado.");
  });
})();
