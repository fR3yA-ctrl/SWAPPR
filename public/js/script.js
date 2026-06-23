const API = "/api"; // FIX: use relative path, not hardcoded localhost

let currentUser = null;
let currentFilter = "all";
let notebooks = [];
let swapps = [];
let editingNotebookId = null;
let selectedSubject = null;
let currentPage = 1;
const ITEMS_PER_PAGE = 6;
const subjects = [
  "Computer Science",
  "Information Technology",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Psychology",
  "Economics",
  "Biology",
  "Nursing",
  "Pharmacy",
  "Political Science",
  "Mathematics",
];

// ─── INIT ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // FIX: use sessionStorage (consistent with login.html)
  loadUser();
  loadNotebooks();
  loadSwapps();
  loadSidebar();
  attachStaticEventListeners();
});

// ─── STATIC BUTTONS ─────────────────────────────────────
function attachStaticEventListeners() {
  const themeToggle = document.getElementById("themeToggle");

  function updateThemeIcon() {
    if (!themeToggle) return;

    const isDark = document.documentElement.classList.contains("dark");
    const nextIcon = isDark ? "sun" : "moon";

    // Always reset icon safely
    themeToggle.innerHTML = `
      <i data-lucide="${nextIcon}" class="w-5 h-5"></i>
    `;

    lucide.createIcons();
  }

  if (themeToggle) {
    // Restore saved theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }

    // Set correct icon on load
    updateThemeIcon();

    // Toggle theme
    themeToggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");

      const isDark = document.documentElement.classList.contains("dark");
      localStorage.setItem("theme", isDark ? "dark" : "light");

      updateThemeIcon(); // update icon after toggle
    });
  }

  // Search input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      resetPagination();
      renderNotebooks();
    });
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

function toggleChat() {
  const panel = document.getElementById("chatPanel");

  if (panel.classList.contains("scale-0")) {
    panel.classList.remove("scale-0", "opacity-0");
    panel.classList.add("scale-100", "opacity-100");
  } else {
    panel.classList.add("scale-0", "opacity-0");
    panel.classList.remove("scale-100", "opacity-100");
  }
}

// ─── NOTEBOOKS ──────────────────────────────────────────
async function loadNotebooks() {
  try {
    const res = await fetch(`${API}/portfolios`);
    const data = await res.json();
    notebooks = data.portfolios || [];

    const editNotebookId = sessionStorage.getItem("editNotebookId");
    if (editNotebookId) {
      sessionStorage.removeItem("editNotebookId");
      const notebook = notebooks.find((n) => n.id === Number(editNotebookId));
      if (notebook) {
        openEditNotebookModal(notebook);
      }
    }

    renderNotebooks();
  } catch (err) {
    console.error("Failed to load notebooks:", err);
  }
}

function selectSubject(subject) {
  selectedSubject = subject;
  currentFilter = "all";
  resetPagination();
  updateSectionTitle();
  document.getElementById("backToSubjectsBtn")?.classList.add("hidden");
  renderNotebooks();
}

function resetSubjects() {
  selectedSubject = null;
  resetPagination();
  updateSectionTitle();
  document.getElementById("backToSubjectsBtn")?.classList.add("hidden");
  renderNotebooks();
}

function resetPagination() {
  currentPage = 1;
}

function getPaginatedItems(items) {
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  return items.slice(start, start + ITEMS_PER_PAGE);
}

function changePage(page) {
  currentPage = page;
  renderNotebooks();
  document
    .getElementById("sectionTitle")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPagination(totalItems) {
  const pagination = document.getElementById("paginationControls");
  if (!pagination) return;

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    pagination.classList.add("hidden");
    return;
  }

  pagination.classList.remove("hidden");

  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `
      <button
        type="button"
        class="pagination-page ${page === currentPage ? "active" : ""}"
        data-page="${page}"
        aria-label="Go to page ${page}"
        ${page === currentPage ? 'aria-current="page"' : ""}
      >
        ${page}
      </button>
    `;
  }).join("");

  pagination.innerHTML = `
    <div class="pagination-summary">
      Page ${currentPage} of ${totalPages}
    </div>
    <div class="pagination-actions">
      <button
        type="button"
        class="pagination-btn"
        data-page="${currentPage - 1}"
        ${currentPage === 1 ? "disabled" : ""}
      >
        Previous
      </button>
      <div class="pagination-pages">${pageButtons}</div>
      <button
        type="button"
        class="pagination-btn"
        data-page="${currentPage + 1}"
        ${currentPage === totalPages ? "disabled" : ""}
      >
        Next
      </button>
    </div>
  `;

  pagination.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.page);
      if (!button.disabled && page >= 1 && page <= totalPages) {
        changePage(page);
      }
    });
  });
}

function updateSectionTitle() {
  const sectionTitle = document.getElementById("sectionTitle");
  const sectionSubtitle = document.getElementById("sectionSubtitle");
  if (!sectionTitle) return;
  if (selectedSubject) {
    sectionTitle.textContent = "All Notebooks";
    if (sectionSubtitle) {
      sectionSubtitle.textContent = "Discover and exchange study materials";
    }
    return;
  }

  const titles = {
    all: "All Subjects",
    mine: "My Subjects",
    matched: "SWAPP Matches",
    requests: "Requests",
    top: "Top Subjects",
    recent: "Recently Added",
  };

  sectionTitle.textContent = titles[currentFilter] || "Subjects";
  if (sectionSubtitle) {
    sectionSubtitle.textContent =
      "Browse shared subjects and study resources in a Reddit-style feed.";
  }
}

function renderSubjectCards() {
  const grid = document.getElementById("notebookGrid");
  if (!grid) return;
  grid.innerHTML = "";
  grid.className = "subjects-list";

  const sectionTitle = document.getElementById("sectionTitle");
  if (sectionTitle) {
    sectionTitle.textContent = "Subjects";
  }
  const sectionSubtitle = document.getElementById("sectionSubtitle");
  if (sectionSubtitle) {
    sectionSubtitle.textContent =
      "Browse shared subjects and study resources in a Reddit-style feed.";
  }

  document.getElementById("backToSubjectsBtn")?.classList.add("hidden");

  const visibleSubjects = getPaginatedItems(subjects);
  renderPagination(subjects.length);

  visibleSubjects.forEach((subject) => {
    const card = document.createElement("div");
    card.className = "subject-card fade-in";
    card.innerHTML = `
      <div class="subject-card-inner">
        <div>
          <h3 class="subject-title">${subject}</h3>
          <p class="subject-desc">
            Explore notebooks shared by users for ${subject}.
          </p>
        </div>
        <button class="subject-cta" data-subject="${subject}">
          View Swaps
        </button>
      </div>
    `;

    card.querySelector("button")?.addEventListener("click", () => {
      selectSubject(subject);
    });

    grid.appendChild(card);
  });
}

function renderNotebooks() {
  const grid = document.getElementById("notebookGrid");
  if (!grid) return;

  const searchQuery =
    document.getElementById("searchInput")?.value?.toLowerCase() || "";

  if (!selectedSubject && currentFilter === "all" && !searchQuery) {
    renderSubjectCards();
    return;
  }

  grid.innerHTML = "";
  grid.className = "notebooks-grid";

  let filtered = [...notebooks];

  // 🔍 SEARCH
  if (searchQuery) {
    filtered = filtered.filter(
      (n) =>
        n.title.toLowerCase().includes(searchQuery) ||
        n.username.toLowerCase().includes(searchQuery),
    );
  }

  if (selectedSubject) {
    const subjectFilter = selectedSubject.toLowerCase();
    filtered = filtered.filter((n) => {
      const dept = (n.department || "").toLowerCase();
      const course = (n.course || "").toLowerCase();
      return dept.includes(subjectFilter) || course.includes(subjectFilter);
    });
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
    renderPagination(0);
    attachRequestListeners();
    return;
  }

  if (currentFilter === "top") {
    // Count notebooks per user
    const userCounts = {};
    notebooks.forEach((n) => {
      userCounts[n.username] = (userCounts[n.username] || 0) + 1;
    });

    // Sort users by count
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 contributors
      .map(([username]) => username);

    // Filter notebooks from top contributors
    filtered = filtered.filter((n) => topUsers.includes(n.username));
  }

  // Recently Added Filter
  if (currentFilter === "recent") {
    // Sort by most recent (assuming notebooks have a timestamp or ID)
    // If you have a createdAt field, use that. Otherwise, reverse the array
    filtered = [...filtered].reverse().slice(0, 20); // Show 20 most recent
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="text-sm text-purple-400">No results found.</p>`;
    renderPagination(0);
    return;
  }

  grid.className = selectedSubject ? "notebooks-grid" : "subjects-list";
  const visibleNotebooks = getPaginatedItems(filtered);
  renderPagination(filtered.length);

  visibleNotebooks.forEach((n) => {
    const card = document.createElement("div");
    card.className = "post-card fade-in";

    const canSwapp =
      currentUser &&
      n.username !== currentUser.username &&
      !swapps.some(
        (s) =>
          (s.sender === currentUser.username && s.receiver === n.username) ||
          (s.receiver === currentUser.username && s.sender === n.username),
      );

    const hasSwapp = swapps.some(
      (s) =>
        ((s.sender === currentUser?.username && s.receiver === n.username) ||
          (s.receiver === currentUser?.username && s.sender === n.username)) &&
        s.status === "accepted",
    );

    const maxDescLength = 140;
    const displayDesc = n.description
      ? n.description.length > maxDescLength
        ? n.description.slice(0, maxDescLength) + "..."
        : n.description
      : "No description provided";

    const wordCount = n.wordCount || Math.floor(Math.random() * 12000) + 2000;
    const subjectLabel = n.department || n.course || "General";
    const courseLabel = n.course || n.department || "General";
    const trustScore = n.trustScore || 98;
    const levelTag =
      n.level ||
      (wordCount > 15000
        ? "COMPREHENSIVE"
        : wordCount > 8000
        ? "COMPREHENSIVE"
        : wordCount > 4000
        ? "STANDARD"
        : "QUICK REVIEW");

    card.className = "notebook-card fade-in";
    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3 class="card-title">${n.title || "Untitled Notebook"}</h3>
          <p class="card-username">by @${n.username || "anonymous"}</p>
          <p class="card-description">${displayDesc}</p>
        </div>
      </div>

      <div class="card-subject-row">
        <span class="card-subject-text">${subjectLabel} &bull; COURSE &bull; Reviewer</span>
      </div>

      <div class="card-badge-row">
        <span class="card-badge">${levelTag}</span>
      </div>

      <div class="metadata-dashboard">
        <div class="meta-pill">
          <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
          ${wordCount.toLocaleString()} words
        </div>
        <div class="meta-pill">
          <i data-lucide="image" class="w-3.5 h-3.5"></i>
          ${n.imageCount || 18} diagrams
        </div>
        <div class="meta-pill">
          <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
          ${n.pageCount || 72} pages
        </div>
      </div>

      <div class="meta-bottom-row">
        <div class="read-time">
          <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          ${n.readTime || 48} min read
        </div>
        <div class="trust-score">
          <i data-lucide="shield-check" class="w-4 h-4"></i>
          ${trustScore}% Trust Score
        </div>
      </div>

      <div class="card-footer">
        <span class="footer-text">PREVIEW &bull; UNLOCK VIA SWAP</span>
        <div class="action-container"></div>
      </div>
    `;

    const actionContainer = card.querySelector(".action-container");

    // Show appropriate button based on state
    if (n.username === currentUser?.username) {
      // Own notebook - no action needed
      const badge = document.createElement("span");
      badge.className = "text-xs text-purple-400 font-medium";
      badge.textContent = "Your Notebook";
      actionContainer.appendChild(badge);
    } else if (hasSwapp) {
      // Already swapped - show access
      const accessBtn = document.createElement("button");
      accessBtn.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i> Access';
      accessBtn.className =
        "text-sm px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition shadow-sm";
      accessBtn.addEventListener("click", () => {
        if (n.fileUrl || n.file_url) {
          window.open(n.fileUrl || n.file_url, "_blank");
        } else {
          showToast("No file URL available");
        }
      });
      actionContainer.appendChild(accessBtn);
    } else if (canSwapp) {
      // Can initiate swap
      const swapBtn = document.createElement("button");
      swapBtn.innerHTML = '<i data-lucide="repeat-2" class="w-4 h-4"></i> Request Swap';
      swapBtn.className =
        "text-sm px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition shadow-sm";
      swapBtn.addEventListener("click", async () => {
        swapBtn.disabled = true;
        swapBtn.textContent = "Sending...";

        try {
          await sendSwapp(n.username);
          showToast("Swap request sent!");
          await loadSwapps();
          renderNotebooks(); // Refresh to show "Pending" state
        } catch (err) {
          showToast("Failed to send request");
          console.error(err);
        } finally {
          swapBtn.disabled = false;
          swapBtn.innerHTML = '<i data-lucide="repeat-2" class="w-4 h-4"></i> Request Swap';
          lucide.createIcons();
        }
      });
      actionContainer.appendChild(swapBtn);
    } else {
      // Pending swap
      const pendingBadge = document.createElement("span");
      pendingBadge.className =
        "text-xs text-yellow-600 dark:text-yellow-400 font-medium";
      pendingBadge.textContent = "Swap Pending...";
      actionContainer.appendChild(pendingBadge);
    }

    grid.appendChild(card);
  });

  // FIX: Reinitialize icons after rendering
  lucide.createIcons();
}

// ─── CREATE NOTEBOOK ────────────────────────────────────
async function submitPortfolio() {
  const title = document.getElementById("newTitle").value;
  const description = document.getElementById("newDescription").value;
  const department = document.getElementById("newDept").value;
  const fileUrl = document.getElementById("newFileUrl").value;

  if (!title) return alert("Title required");

  try {
    const method = editingNotebookId ? "PUT" : "POST";
    const url = editingNotebookId
      ? `${API}/portfolios/${editingNotebookId}`
      : `${API}/portfolios`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        department,
        fileUrl,
        username: currentUser.username,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || "Failed to save notebook");
      return;
    }

    showToast(editingNotebookId ? "Notebook updated!" : "Notebook created!");
    closeAddModal();
    editingNotebookId = null;
    loadNotebooks();
    loadSidebar();
  } catch (err) {
    console.error(err);
    showToast("Server error");
  }
}

// ─── SWAPP REQUESTS ─────────────────────────────────────
function renderRequests() {
  if (!currentUser)
    return `<p class="text-sm text-purple-400">Please log in.</p>`;

  const incoming = swapps.filter(
    (s) => s.receiver === currentUser.username && s.status === "pending",
  );

  if (incoming.length === 0) {
    return `<p class="text-sm text-purple-400 text-center py-8">No pending requests.</p>`;
  }

  return incoming
    .map(
      (s) => `
    <div class="p-5 rounded-xl bg-white dark:bg-[#181428] shadow border border-purple-100 dark:border-white/[0.06] mb-4">
      <div class="flex items-start justify-between mb-3">
        <div>
          <p class="text-sm font-bold text-purple-900 dark:text-purple-100">@${s.sender} wants to swap</p>
          <p class="text-xs text-purple-400 mt-1">Pending your approval</p>
        </div>
        <span class="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-medium">Pending</span>
      </div>
      <div class="flex gap-2 mt-4">
        <button class="respond-btn flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition" data-id="${s.id}" data-status="accepted">
          ✓ Accept
        </button>
        <button class="respond-btn flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition" data-id="${s.id}" data-status="rejected">
          ✕ Deny
        </button>
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

  // FIX: Reinitialize icons after rendering request buttons
  lucide.createIcons();
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
      div.className =
        "text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition cursor-pointer";
      div.textContent = `${n.title}`;
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
  selectedSubject = null;
  resetPagination();
  document.getElementById("backToSubjectsBtn")?.classList.add("hidden");

  const titles = {
    all: "All Subjects",
    mine: "My Subjects",
    matched: "SWAPP Matches",
    requests: "Requests",
    top: "Top Subjects",
    recent: "Recently Added",
  };

  const sectionTitle = document.getElementById("sectionTitle");
  if (sectionTitle) sectionTitle.textContent = titles[type] || "Notebooks";

  // Update active sidebar link
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.filter === type);
  });

  // FIX: Reinitialize icons after sidebar link update
  lucide.createIcons();

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
  console.log("Sending swap request to:", toUsername);
  const response = await fetch(`${API}/swapps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: currentUser.username,
      to: toUsername,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to send swap request");
  }

  return response.json();
}

async function respondSwapp(id, status) {
  try {
    const response = await fetch(`${API}/swapps/${id}/respond`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error("Failed to respond to swap");
    }

    const actionText = status === "accepted" ? "accepted" : "denied";
    showToast(`Swap request ${actionText}!`);

    await loadSwapps();
    if (currentFilter === "requests") renderNotebooks();
  } catch (err) {
    showToast("Failed to process request");
    console.error(err);
  }
}

// ─── PROFILE PANEL ──────────────────────────────────────
async function openProfilePanel() {
  try {
    const res = await fetch(`${API}/profile/${currentUser.username}`);
    const data = await res.json();
    if (!data.success) return;

    const profile = data.profile;

    document.getElementById("profileName").textContent = profile.name;
    document.getElementById("profileUsername").textContent =
      "@" + profile.username;
    document.getElementById("profileBio").textContent = profile.bio || "";
    document.getElementById("profilePortfolioCount").textContent =
      profile.portfolios.length;

    // Populate SWAPP count
    const swappCountEl = document.getElementById("profileSwappCount");
    if (swappCountEl) swappCountEl.textContent = profile.matches?.length || 0;

    // Populate initials for avatar
    const initialsEl = document.getElementById("profileInitials");
    if (initialsEl && profile.name) {
      initialsEl.textContent = profile.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }

    // ✅ Trust Score Display with dynamic coloring
    const trustScoreValue = profile.trustScore ?? "100%";
    const trustScoreEl = document.getElementById("profileTrustScore");
    if (trustScoreEl) {
      trustScoreEl.textContent = trustScoreValue;

      // Dynamic color based on score
      const numericScore = parseInt(trustScoreValue);
      trustScoreEl.classList.remove(
        "text-green-500",
        "dark:text-green-400",
        "text-yellow-500",
        "dark:text-yellow-400",
        "text-red-500",
        "dark:text-red-400",
        "text-purple-700",
        "dark:text-purple-300",
      );

      if (numericScore >= 95) {
        trustScoreEl.classList.add("text-green-500", "dark:text-green-400");
      } else if (numericScore >= 85) {
        trustScoreEl.classList.add("text-yellow-500", "dark:text-yellow-400");
      } else if (numericScore >= 70) {
        trustScoreEl.classList.add("text-red-500", "dark:text-red-400");
      } else {
        trustScoreEl.classList.add("text-purple-700", "dark:text-purple-300");
      }
    }

    const list = document.getElementById("profilePortfolioList");
    list.innerHTML = "";
    profile.portfolios.forEach((p) => {
      const div = document.createElement("div");
      div.className =
        "text-sm py-1 border-b border-purple-100 dark:border-white/[0.05]";
      div.textContent = p.title;
      list.appendChild(div);
    });

    // Show matches in panel
    const matchList = document.getElementById("profileMatchList");
    if (matchList) {
      matchList.innerHTML = profile.matches?.length
        ? profile.matches
            .map((u) => `<div class="text-xs text-purple-400">@${u}</div>`)
            .join("")
        : `<p class="text-xs text-purple-300">No matches yet.</p>`;
    }

    document.getElementById("profilePanel").classList.add("open");
    document.getElementById("profileOverlay").classList.add("active");

    // FIX: Reinitialize icons after profile panel opens
    setTimeout(() => lucide.createIcons(), 100);
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

function closeProfilePanel() {
  document.getElementById("profilePanel").classList.remove("open");
  document.getElementById("profileOverlay").classList.remove("active");
}

// ─── MODAL ──────────────────────────────────────────────
function clearPortfolioForm() {
  const titleInput = document.getElementById("newTitle");
  const descriptionInput = document.getElementById("newDescription");
  const deptInput = document.getElementById("newDept");
  const fileUrlInput = document.getElementById("newFileUrl");
  const actionBtn = document.getElementById("portfolioActionBtn");

  if (titleInput) titleInput.value = "";
  if (descriptionInput) descriptionInput.value = "";
  if (deptInput) deptInput.value = "";
  if (fileUrlInput) fileUrlInput.value = "";
  if (actionBtn) actionBtn.textContent = "Publish Notebook";
}

function openAddModal() {
  editingNotebookId = null;
  document.getElementById("modalHeading").textContent = "New Notebook";
  clearPortfolioForm();

  if (selectedSubject) {
    const deptInput = document.getElementById("newDept");
    if (deptInput) {
      const existingOption = Array.from(deptInput.options).find(
        (option) =>
          option.value.toLowerCase() === selectedSubject.toLowerCase() ||
          option.text.toLowerCase().includes(selectedSubject.toLowerCase()),
      );

      if (existingOption) {
        deptInput.value = existingOption.value;
      } else {
        const customOption = document.createElement("option");
        customOption.value = selectedSubject;
        customOption.text = selectedSubject;
        deptInput.appendChild(customOption);
        deptInput.value = selectedSubject;
      }
    }
  }

  document.getElementById("addModal").classList.remove("hidden");
  // FIX: Reinitialize icons when modal opens
  setTimeout(() => lucide.createIcons(), 100);
}

function openEditNotebookModal(notebook) {
  editingNotebookId = notebook.id;
  document.getElementById("modalHeading").textContent = "Edit Notebook";
  document.getElementById("newTitle").value = notebook.title || "";
  document.getElementById("newDescription").value = notebook.description || "";
  document.getElementById("newDept").value = notebook.department || "";
  document.getElementById("newFileUrl").value = notebook.file_url || "";
  const actionBtn = document.getElementById("portfolioActionBtn");
  if (actionBtn) actionBtn.textContent = "Save Changes";
  document.getElementById("addModal").classList.remove("hidden");
  setTimeout(() => lucide.createIcons(), 100);
}

function closeAddModal(e) {
  if (!e || e.target.id === "addModal") {
    document.getElementById("addModal").classList.add("hidden");
    editingNotebookId = null;
    clearPortfolioForm();
  }
}

// ─── TOAST HELPER ───────────────────────────────────────
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className =
    "toast fixed bottom-24 right-6 bg-purple-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 transition-all duration-300";
  toast.style.display = "block";
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => {
      toast.style.display = "none";
    }, 300);
  }, 3000);
}
