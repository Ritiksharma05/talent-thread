const profileEditElements = {
  authGate: document.querySelector("#authGate"),
  profileForm: document.querySelector("#profileForm"),
  profileImageFile: document.querySelector("#profileImageFile"),
  saveProfileButton: document.querySelector("#saveProfileButton"),
  saveToast: document.querySelector("#saveToast"),
  statusMessage: document.querySelector("#statusMessage")
};

function showSaveToast(message) {
  if (!profileEditElements.saveToast) {
    return;
  }

  profileEditElements.saveToast.textContent = message;
  profileEditElements.saveToast.classList.remove("hidden");
  profileEditElements.saveToast.classList.add("toast-visible");
}

function applyProfileImage(value) {
  profileEditElements.profileForm.elements.profileImage.value = value || "";
  profileEditElements.profileImageFile.required = !value;
}

function renderUnauthorized() {
  TalentThread.hide(profileEditElements.profileForm);
  profileEditElements.statusMessage.textContent = "Log in to edit your profile.";
  TalentThread.renderAuthGate(
    profileEditElements.authGate,
    "Login required",
    "Sign in before editing your profile details.",
    "/login.html"
  );
}

function fillProfileForm(profile) {
  TalentThread.hide(profileEditElements.authGate);
  TalentThread.show(profileEditElements.profileForm);
  applyProfileImage(profile.profileImage || "");
  profileEditElements.profileImageFile.value = "";
  profileEditElements.profileForm.elements.fullName.value = profile.fullName || profile.name || "";
  profileEditElements.profileForm.elements.headline.value = profile.headline || "";
  profileEditElements.profileForm.elements.city.value = profile.city || "";
  profileEditElements.profileForm.elements.preferredRate.value = profile.preferredRate || "";
  profileEditElements.profileForm.elements.availability.value = profile.availability || "Open to freelance";
  profileEditElements.profileForm.elements.about.value = profile.about || "";
  profileEditElements.profileForm.elements.bio.value = profile.bio || "";
  profileEditElements.profileForm.elements.projectsInfo.value = profile.projectsInfo || "";
  profileEditElements.statusMessage.textContent = "Update your profile details and save to return to your profile page.";
}

async function loadProfileEditor() {
  try {
    const session = await TalentThread.requestJson("/api/me", { method: "GET" });
    if (!session.authenticated || !session.user || session.user.role !== "designer") {
      renderUnauthorized();
      return;
    }
    const state = await TalentThread.requestJson("/api/designer/state", { method: "GET" });
    fillProfileForm(state.profile || {});
  } catch (error) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      renderUnauthorized();
      return;
    }
    profileEditElements.statusMessage.textContent = error.message;
  }
}

profileEditElements.profileImageFile.addEventListener("change", () => {
  const [file] = profileEditElements.profileImageFile.files || [];
  if (!file) {
    applyProfileImage("");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    applyProfileImage(typeof reader.result === "string" ? reader.result : "");
  };
  reader.readAsDataURL(file);
});

profileEditElements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  profileEditElements.saveProfileButton.disabled = true;
  profileEditElements.saveProfileButton.textContent = "Saving...";

  try {
    const data = new FormData(profileEditElements.profileForm);
    const payload = {
      about: String(data.get("about") || "").trim(),
      availability: String(data.get("availability") || "").trim(),
      bio: data.get("bio"),
      city: String(data.get("city") || "").trim(),
      fullName: String(data.get("fullName") || "").trim(),
      headline: data.get("headline"),
      preferredRate: data.get("preferredRate"),
      profileImage: String(data.get("profileImage") || "").trim(),
      projectsInfo: data.get("projectsInfo")
    };

    if (!payload.profileImage || !payload.fullName || !payload.city || !payload.availability || !payload.about) {
      profileEditElements.statusMessage.textContent = "Profile photo, full name, city, availability, and about are required.";
      return;
    }

    await TalentThread.requestJson("/api/profile", {
      body: JSON.stringify(payload),
      method: "POST"
    });
    showSaveToast("Details has been saved successfully");
    window.sessionStorage.setItem("profileSaveSuccess", "Details has been saved successfully");
    window.setTimeout(() => {
      window.location.href = "/profile.html";
    }, 900);
  } catch (error) {
    profileEditElements.statusMessage.textContent = error.message;
  } finally {
    profileEditElements.saveProfileButton.disabled = false;
    profileEditElements.saveProfileButton.textContent = "Save Profile";
  }
});

loadProfileEditor();


