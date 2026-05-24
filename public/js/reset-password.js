const resetElements = {
  button: document.querySelector("#resetPasswordButton"),
  form: document.querySelector("#resetPasswordForm"),
  message: document.querySelector("#resetMessage")
};

function resetToken() {
  return new URLSearchParams(window.location.search).get("token") || "";
}

resetElements.form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = resetToken();
  const password = new FormData(resetElements.form).get("password");

  if (!token) {
    resetElements.message.textContent = "This reset link is missing a token.";
    return;
  }

  resetElements.button.disabled = true;
  resetElements.button.textContent = "Updating...";

  try {
    const data = await TalentThread.requestJson("/api/reset-password", {
      method: "POST",
      body: JSON.stringify({ password, token })
    });
    window.sessionStorage.setItem("signupSuccessMessage", "Password updated. You can sign in now.");
    window.location.href = data.redirectTo || "/login.html";
  } catch (error) {
    resetElements.message.textContent = error.message;
    resetElements.button.disabled = false;
    resetElements.button.textContent = "Update Password →";
  }
});
