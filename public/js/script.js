const API = "/api";  // FIX: use relative path, not hardcoded localhost

let currentUser = null;
let currentFilter = "all";
let notebooks = [];
let swapps = [];

// ─── INIT ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // FIX: use sessionStorage (consistent with login.html)
  loadUser();
  loadNotebooks();
  loadSidebar();
  loadSwapps();
  attachStaticEventListeners();
});

// ─── STATIC BUTTONS ─────────────────────────────────────
function attachStaticEventListeners() {
  // FIX: themeToggle is the correct ID in index.html (not darkModeBtn)
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    // Restore saved theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") document.documentElement.classList.add("dark");
    themeToggle.textContent = document.documentElement.classList.contains("dark") ? "☀️" : "🌙";
    themeToggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      const isDark = document.documentElement.classList.contains("dark");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      themeToggle.textContent = isDark ? "☀️" : "🌙";
    });
  }

  // FIX: search input - attach event listener here
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", renderNotebooks);
  }
}

// ─── USER SESSION ───────────────────────────────────────
function loadUser() {
  // FIX: use sessionStorage (login.html stores user in sessionStorage)
  const stored = sessionStorage.getItem("currentUser");
  if (stored && stored !== "undefined" && stored !== "null") {
    try {
      currentUser = JSON.parse(stored);
    } catch {
      currentUser = null;
    }
  }

  if (currentUser && currentUser.username) {
    const userBadge = document.getElementById("userBadge");
    const addBtn = document.getElementById("addPortfolioBtn");
    const userBadgeName = document.getElementById("userBadgeName");
    if (userBadge) userBadge.classList.remove("hidden");
    if (addBtn) addBtn.classList.remove("hidden");
    if (userBadgeName) userBadgeName.textContent = currentUser.name;
  } else {
    // Not logged in — redirect to login
    window.location.href = "login.html";
  }
}

function handleLogout() {
  sessionStorage.removeItem("currentUser");
  window.location.href = "login.html";
}

// ─── NOTEBOOKS ──────────────────────────────────────────
async function loadNotebooks() {
  try {
    const res = await fetch(`${API}/portfolios`);
    const data = await res.json();
    notebooks = data.portfolios || [];
    renderNotebooks();
  } catch (err) {
    console.error("Failed to load notebooks:", err);
  }
}

function renderNotebooks() {
  const grid = document.getElementById("notebookGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const searchQuery =
    document.getElementById("searchInput")?.value?.toLowerCase() || "";

  let filtered = [...notebooks];

  // 🔍 SEARCH
  if (searchQuery) {
    filtered = filtered.filter(
      (n) =>
        n.title.toLowerCase().includes(searchQuery) ||
        n.username.toLowerCase().includes(searchQuery),
    );
  }

  // 📂 FILTERS
  if (currentFilter === "mine") {
    filtered = filtered.filter((n) => n.username === currentUser?.username);
  }

  if (currentFilter === "matched") {
    const matchedUsers = swapps
      .filter((s) => s.status === "accepted")
      .map((s) => (s.sender === currentUser.username ? s.receiver : s.sender));
    filtered = filtered.filter((n) => matchedUsers.includes(n.username));
  }

  if (currentFilter === "requests") {
    grid.innerHTML = renderRequests();
    attachRequestListeners();
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="text-sm text-purple-400">No results found.</p>`;
    return;
  }

  filtered.forEach((n) => {
    const card = document.createElement("div");
    card.className = "p-4 rounded-xl bg-white dark:bg-[#181428] shadow";

    const canSwapp =
      currentUser &&
      n.username !== currentUser.username &&
      !swapps.some(
        (s) =>
          (s.sender === currentUser.username && s.receiver === n.username) ||
          (s.receiver === currentUser.username && s.sender === n.username),
      );

    card.innerHTML = `
      <h3 class="font-bold text-lg">${n.title}</h3>
      <p class="text-xs text-purple-400">${n.username}</p>
      <p class="text-sm mt-2">${n.description || ""}</p>
      <div class="flex justify-between items-center mt-4">
        <span>❤️ ${n.likes || 0}</span>
        <div class="flex gap-2">
          <div class="like-container"></div>
          <div class="swapp-container"></div>
        </div>
      </div>
    `;

    if (currentUser && n.username !== currentUser.username) {
      const likeBtn = document.createElement("button");
      likeBtn.textContent = "❤️ Like";
      likeBtn.className = "text-sm px-2 py-1 rounded bg-purple-400 text-white";
      likeBtn.addEventListener("click", () => likeNotebook(n.id));
      card.querySelector(".like-container").appendChild(likeBtn);
    }

    if (canSwapp) {
      const swappBtn = document.createElement("button");
      swappBtn.textContent = "⇄ SWAPP";
      swappBtn.className = "text-sm px-2 py-1 rounded bg-indigo-500 text-white";
      swappBtn.addEventListener("click", () => sendSwapp(n.username));
      card.querySelector(".swapp-container").appendChild(swappBtn);
    }

    grid.appendChild(card);
  });
}

// ─── CREATE NOTEBOOK ────────────────────────────────────
async function submitPortfolio() {
  const title = document.getElementById("newTitle").value;
  const description = document.getElementById("newDescription").value;
  const department = document.getElementById("newDept").value;
  const fileUrl = document.getElementById("newFileUrl").value;

  if (!title) return alert("Title required");

  await fetch(`${API}/portfolios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description,
      department,
      fileUrl,
      author: currentUser.username,
    }),
  });

  closeAddModal();
  loadNotebooks();
}

// ─── SWAPP REQUESTS ─────────────────────────────────────
function renderRequests() {
  if (!currentUser) return `<p class="text-sm text-purple-400">Please log in.</p>`;

  const incoming = swapps.filter(
    (s) => s.receiver === currentUser.username && s.status === "pending",
  );

  if (incoming.length === 0) {
    return `<p class="text-sm text-purple-400">No requests.</p>`;
  }

  return incoming
    .map(
      (s) => `
    <div class="p-4 rounded-xl bg-white dark:bg-[#181428] shadow mb-3">
      <p class="text-sm font-semibold">${s.sender} wants to SWAPP</p>
      <div class="flex gap-2 mt-3">
        <button class="text-green-500 respond-btn" data-id="${s.id}" data-status="accepted">Accept</button>
        <button class="text-red-500 respond-btn" data-id="${s.id}" data-status="rejected">Deny</button>
      </div>
    </div>
  `,
    )
    .join("");
}

function attachRequestListeners() {
  document.querySelectorAll(".respond-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      respondSwapp(btn.dataset.id, btn.dataset.status);
    });
  });
}

// ─── LIKE ───────────────────────────────────────────────
async function likeNotebook(id) {
  await fetch(`${API}/portfolios/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: currentUser.username,
      notebookId: id,
    }),
  });

  loadNotebooks();
  loadSidebar();
}

// ─── SIDEBAR ────────────────────────────────────────────
async function loadSidebar() {
  await loadTop();
  await loadRecent();
}

async function loadTop() {
  try {
    const res = await fetch(`${API}/portfolios/top`);
    const data = await res.json();
    const container = document.getElementById("sidebarTop");
    if (!container) return;
    container.innerHTML = "";
    data.portfolios?.forEach((n) => {
      const div = document.createElement("div");
      div.className = "text-xs";
      div.textContent = `${n.title} ❤️ ${n.likes || 0}`;
      container.appendChild(div);
    });
  } catch {}
}

async function loadRecent() {
  try {
    const res = await fetch(`${API}/portfolios/recent`);
    const data = await res.json();
    const container = document.getElementById("sidebarRecent");
    if (!container) return;
    container.innerHTML = "";
    data.portfolios?.forEach((n) => {
      const div = document.createElement("div");
      div.className = "text-xs";
      div.textContent = n.title;
      container.appendChild(div);
    });
  } catch {}
}

// ─── FILTER ─────────────────────────────────────────────
function filterBy(type) {
  currentFilter = type;

  const titles = {
    all: "All Notebooks",
    mine: "My Notebooks",
    matched: "SWAPP Matches",
    requests: "Requests",
  };

  const sectionTitle = document.getElementById("sectionTitle");
  if (sectionTitle) sectionTitle.textContent = titles[type] || "Notebooks";

  // Update active sidebar link
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.filter === type);
  });

  renderNotebooks();
}

// ─── SWAPPS ─────────────────────────────────────────────
async function loadSwapps() {
  if (!currentUser) return;

  try {
    const res = await fetch(`${API}/swapps/${currentUser.username}`);
    const data = await res.json();
    swapps = data.swapps || [];
    updateRequestBadge();
  } catch {}
}

function updateRequestBadge() {
  const badge = document.getElementById("requestsBadge");
  if (!badge || !currentUser) return;

  const count = swapps.filter(
    (s) => s.receiver === currentUser.username && s.status === "pending",
  ).length;

  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

async function sendSwapp(toUsername) {
  await fetch(`${API}/swapps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: currentUser.username,
      to: toUsername,
    }),
  });

  alert("Swapp sent!");
  await loadSwapps();
  renderNotebooks();
}

async function respondSwapp(id, status) {
  await fetch(`${API}/swapps/${id}/respond`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  await loadSwapps();
  if (currentFilter === "requests") renderNotebooks();
}

// ─── PROFILE PANEL ──────────────────────────────────────
async function openProfilePanel() {
  try {
    const res = await fetch(`${API}/profile/${currentUser.username}`);
    const data = await res.json();
    if (!data.success) return;

    const profile = data.profile;

    document.getElementById("profileName").textContent = profile.name;
    document.getElementById("profileUsername").textContent = "@" + profile.username;
    document.getElementById("profileBio").textContent = profile.bio || "";
    document.getElementById("profilePortfolioCount").textContent =
      profile.portfolios.length;

    // FIX: populate SWAPP count if element exists
    const swappCountEl = document.getElementById("profileSwappCount");
    if (swappCountEl) swappCountEl.textContent = profile.matches?.length || 0;

    // FIX: populate initials for avatar
    const initialsEl = document.getElementById("profileInitials");
    if (initialsEl && profile.name) {
      initialsEl.textContent = profile.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }

    const list = document.getElementById("profilePortfolioList");
    list.innerHTML = "";
    profile.portfolios.forEach((p) => {
      const div = document.createElement("div");
      div.className = "text-sm py-1 border-b border-purple-100 dark:border-white/[0.05]";
      div.textContent = p.title;
      list.appendChild(div);
    });

    // Show matches in panel
    const matchList = document.getElementById("profileMatchList");
    if (matchList) {
      matchList.innerHTML = profile.matches?.length
        ? profile.matches.map((u) => `<div class="text-xs text-purple-400">@${u}</div>`).join("")
        : `<p class="text-xs text-purple-300">No matches yet.</p>`;
    }

    document.getElementById("profilePanel").classList.add("open");
    document.getElementById("profileOverlay").classList.add("active");
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

function closeProfilePanel() {
  document.getElementById("profilePanel").classList.remove("open");
  document.getElementById("profileOverlay").classList.remove("active");
}

// ─── MODAL ──────────────────────────────────────────────
function openAddModal() {
  document.getElementById("addModal").classList.remove("hidden");
}

function closeAddModal(e) {
  if (!e || e.target.id === "addModal") {
    document.getElementById("addModal").classList.add("hidden");
  }
}
