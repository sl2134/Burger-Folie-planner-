document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".mobile-tabbar button[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      if (typeof showPage === "function") {
        showPage(button.dataset.page);
      }
    });
  });
});
