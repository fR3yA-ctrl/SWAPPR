console.log("🔥 NEW SQLITE SERVER RUNNING");
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const db = new sqlite3.Database("./swappr.db", (err) => {
  if (err) return console.error(err.message);
  console.log("Connected to SQLite database.");
});

// ✅ Promisify db.run to wait for table creation
const dbRun = (sql) =>
  new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

// ✅ Create tables and WAIT before starting server
async function initializeDatabase() {
  try {
    console.log("📦 Creating tables...");
    await dbRun(`CREATE TABLE IF NOT EXISTS Users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT, username TEXT UNIQUE, password TEXT,
 bio TEXT, course TEXT, department TEXT, yearLevel TEXT
 )`);
    await dbRun(`CREATE TABLE IF NOT EXISTS Notebooks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT, description TEXT, department TEXT,
 author_id INTEGER, file_url TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
 )`);
    await dbRun(`CREATE TABLE IF NOT EXISTS Likes (
 user_id INTEGER, notebook_id INTEGER,
 PRIMARY KEY (user_id, notebook_id)
 )`);
    await dbRun(`CREATE TABLE IF NOT EXISTS Swapps (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 sender_id INTEGER, receiver_id INTEGER, status TEXT
 )`);

    // ─── CHAT TABLE ────────────────────────────────────────────────────────
    // Messages are tied to an accepted Swapp (swap_id).
    // expires_at = created_at + 7 days, used by the cleanup job.
    await dbRun(`CREATE TABLE IF NOT EXISTS Messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  swap_id    INTEGER NOT NULL,
  sender_id  INTEGER NOT NULL,
  content    TEXT    NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (swap_id)   REFERENCES Swapps(id)  ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES Users(id)   ON DELETE CASCADE
)`);

    console.log("✅ Database initialized!");
    return true;
  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
    return false;
  }
}

// ─── CHAT CLEANUP JOB ─────────────────────────────────────────────────────
// Runs once on startup and then every hour.
// Deletes any message whose expires_at has passed.
function runChatCleanup() {
  db.run(
    `DELETE FROM Messages WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')`,
    (err) => {
      if (err) console.error("❌ Chat cleanup error:", err.message);
      else console.log("🧹 Chat cleanup ran — expired messages removed.");
    },
  );
}

// ─── AUTH ─────────────────────────────────────────────────────────────────
app.post("/api/register", (req, res) => {
  console.log("[REGISTER] Request received:", req.body);
  console.log("DEBUG: Incoming request body keys:", Object.keys(req.body));
  console.log("DEBUG: Full body:", JSON.stringify(req.body));

  const { name, username, password, course, department, yearLevel } = req.body;

  if (!name || !username || !password) {
    console.log("❌ REJECTED - Missing fields:", { name, username, password });
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  db.get(
    `SELECT id FROM Users WHERE username = ?`,
    [username],
    (err, existingUser) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      if (existingUser)
        return res
          .status(400)
          .json({ success: false, message: "Username already taken" });

      const finalDept = department || course || "";
      const finalCourse = course || "";
      const finalYear = yearLevel || "";

      db.run(
        `INSERT INTO Users (name, username, password, course, department, yearLevel)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [name, username, password, finalCourse, finalDept, finalYear],
        function (err) {
          if (err) {
            console.error("[REGISTER] Insert error:", err);
            return res
              .status(500)
              .json({ success: false, message: "Registration failed" });
          }

          console.log("[REGISTER] Success - User created ID:", this.lastID);
          res.status(201).json({
            success: true,
            userId: this.lastID,
            user: { id: this.lastID, name, username, course: finalCourse },
          });
        },
      );
    },
  );
});

// ─── LOGIN ──────────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM Users WHERE username = ?`, [username], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }
    if (user.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect password" });
    }

    res.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name },
    });
  });
});

// ─── PROFILE ──────────────────────────────────────────────────────────────
app.get("/api/profile/:username", (req, res) => {
  db.get(
    `SELECT * FROM Users WHERE username=?`,
    [req.params.username],
    (err, user) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!user) return res.status(404).json({ message: "User not found" });

      db.all(
        `SELECT Notebooks.*, COUNT(Likes.notebook_id) as likes
      FROM Notebooks LEFT JOIN Likes ON Notebooks.id = Likes.notebook_id
      WHERE author_id=? GROUP BY Notebooks.id ORDER BY created_at DESC`,
        [user.id],
        (err, notebooks) => {
          if (err) return res.json({ success: false, message: err.message });

          db.all(
            `SELECT CASE WHEN sender_id=? THEN r.username ELSE s.username END AS matched_user
            FROM Swapps
            JOIN Users s ON Swapps.sender_id = s.id
            JOIN Users r ON Swapps.receiver_id = r.id
            WHERE (sender_id=? OR receiver_id=?) AND status='accepted'`,
            [user.id, user.id, user.id],
            (err, matchRows) => {
              const matches = (matchRows || []).map((r) => r.matched_user);
              res.json({
                success: true,
                profile: {
                  ...user,
                  course: user.course || user.department || "",
                  department: user.department || user.course || "",
                  portfolios: notebooks,
                  matches,
                },
              });
            },
          );
        },
      );
    },
  );
});

app.patch("/api/profile", (req, res) => {
  const { username, name, bio, course, department, yearLevel } = req.body;
  const dept = department || course || "";
  const crs = course || department || "";
  db.run(
    `UPDATE Users SET name=?, bio=?, course=?, department=?, yearLevel=? WHERE username=?`,
    [name, bio, crs, dept, yearLevel, username],
    function (err) {
      if (err) return res.json({ success: false, message: err.message });
      res.json({
        success: true,
        user: { name, bio, course: crs, department: dept, yearLevel },
      });
    },
  );
});

// ─── NOTEBOOKS ────────────────────────────────────────────────────────────
const NB_SELECT = `
      SELECT 
      Notebooks.id, 
      Notebooks.title, 
      Notebooks.description, 
      Notebooks.department,
      Notebooks.file_url, 
      Notebooks.created_at,
      Users.username, 
      COUNT(Likes.notebook_id) AS likes
      FROM Notebooks
      LEFT JOIN Users ON Notebooks.author_id = Users.id
      LEFT JOIN Likes ON Notebooks.id = Likes.notebook_id
      GROUP BY Notebooks.id
      `;

app.get("/api/portfolios", (req, res) => {
  db.all(`${NB_SELECT} ORDER BY Notebooks.created_at DESC`, [], (err, rows) => {
    if (err) return res.json({ success: false, message: err.message });
    res.json({ portfolios: rows || [] });
  });
});

app.get("/api/portfolios/top", (req, res) => {
  db.all(`${NB_SELECT} ORDER BY likes DESC LIMIT 5`, [], (err, rows) => {
    if (err) return res.json({ success: false, message: err.message });
    res.json({ portfolios: rows || [] });
  });
});

app.get("/api/portfolios/recent", (req, res) => {
  db.all(
    `${NB_SELECT} ORDER BY Notebooks.created_at DESC LIMIT 5`,
    [],
    (err, rows) => {
      if (err) return res.json({ success: false, message: err.message });
      res.json({ portfolios: rows || [] });
    },
  );
});

app.post("/api/portfolios", (req, res) => {
  const { title, description, department, author, fileUrl } = req.body;
  db.get(`SELECT id FROM Users WHERE username=?`, [author], (err, user) => {
    if (!user) return res.json({ success: false, message: "User not found" });
    db.run(
      `INSERT INTO Notebooks (title, description, department, author_id, file_url) VALUES (?,?,?,?,?)`,
      [
        title,
        description || null,
        department || null,
        user.id,
        fileUrl || null,
      ],
      function (err) {
        if (err) return res.json({ success: false, message: err.message });
        res.json({ success: true, id: this.lastID });
      },
    );
  });
});

app.put("/api/portfolios/:id", (req, res) => {
  const { title, description, department, fileUrl } = req.body;
  db.run(
    `UPDATE Notebooks SET title=?, description=?, department=?, file_url=? WHERE id=?`,
    [
      title,
      description || null,
      department || null,
      fileUrl || null,
      req.params.id,
    ],
    (err) => {
      if (err) return res.json({ success: false, message: err.message });
      res.json({ success: true });
    },
  );
});

app.post("/api/portfolios/delete", (req, res) => {
  const { id, title, author } = req.body;
  if (id) {
    db.run(`DELETE FROM Notebooks WHERE id=?`, [id], (err) => {
      if (err) return res.json({ success: false, message: err.message });
      res.json({ success: true });
    });
  } else if (title && author) {
    db.get(
      `SELECT Notebooks.id FROM Notebooks JOIN Users ON Notebooks.author_id=Users.id
WHERE Notebooks.title=? AND Users.username=?`,
      [title, author],
      (err, row) => {
        if (err || !row)
          return res.json({ success: false, message: "Notebook not found" });
        db.run(`DELETE FROM Notebooks WHERE id=?`, [row.id], (err) => {
          if (err) return res.json({ success: false, message: err.message });
          res.json({ success: true });
        });
      },
    );
  } else {
    res.json({ success: false, message: "Provide id or title+author" });
  }
});

app.post("/api/portfolios/like", (req, res) => {
  const { username, notebookId } = req.body;
  db.get(`SELECT id FROM Users WHERE username=?`, [username], (err, user) => {
    if (!user) return res.json({ success: false });
    db.run(
      `INSERT INTO Likes (user_id, notebook_id) VALUES (?,?)`,
      [user.id, notebookId],
      (err) => {
        if (err) return res.json({ success: false, message: "Already liked" });
        res.json({ success: true });
      },
    );
  });
});

// ─── SWAPPS ───────────────────────────────────────────────────────────────
app.post("/api/swapps", (req, res) => {
  const { from, to } = req.body;
  db.get(`SELECT id FROM Users WHERE username=?`, [from], (err, sender) => {
    db.get(`SELECT id FROM Users WHERE username=?`, [to], (err, receiver) => {
      if (!sender || !receiver) return res.json({ success: false });
      db.run(
        `INSERT INTO Swapps (sender_id, receiver_id, status) VALUES (?,?,'pending')`,
        [sender.id, receiver.id],
        () => res.json({ success: true }),
      );
    });
  });
});

app.get("/api/swapps/:username", (req, res) => {
  db.get(
    `SELECT id FROM Users WHERE username=?`,
    [req.params.username],
    (err, user) => {
      if (!user) return res.json({ swapps: [] });
      db.all(
        `SELECT Swapps.*, s.username AS sender, r.username AS receiver
FROM Swapps
JOIN Users s ON Swapps.sender_id = s.id
JOIN Users r ON Swapps.receiver_id = r.id
WHERE sender_id=? OR receiver_id=?`,
        [user.id, user.id],
        (err, swapps) => {
          if (err) return res.json({ success: false, message: err.message });
          res.json({ swapps: swapps || [] });
        },
      );
    },
  );
});

app.put("/api/swapps/:id/respond", (req, res) => {
  db.run(
    `UPDATE Swapps SET status=? WHERE id=?`,
    [req.body.status, req.params.id],
    (err) => {
      if (err) return res.json({ success: false, message: err.message });
      res.json({ success: true });
    },
  );
});

// ─── CHAT ─────────────────────────────────────────────────────────────────
//
// All chat routes require the swap to exist AND have status='accepted'.
// This guard is reused by GET and POST below.
//
// Helper: verify the swap exists, is accepted, and that `username` is a party.
function verifySwapAccess(swapId, username, cb) {
  db.get(
    `SELECT Swapps.id, Swapps.status, s.username AS sender, r.username AS receiver
     FROM Swapps
     JOIN Users s ON Swapps.sender_id = s.id
     JOIN Users r ON Swapps.receiver_id = r.id
     WHERE Swapps.id = ?`,
    [swapId],
    (err, swap) => {
      if (err) return cb({ code: 500, message: err.message });
      if (!swap) return cb({ code: 404, message: "Swap not found" });
      if (swap.status !== "accepted")
        return cb({
          code: 403,
          message: "Chat is only available for accepted swaps",
        });
      if (swap.sender !== username && swap.receiver !== username)
        return cb({ code: 403, message: "You are not part of this swap" });
      cb(null, swap);
    },
  );
}

// GET /api/chat/:swapId?username=<username>
// Returns all messages for the swap, newest last.
// Also returns who the other party is, and when the chat expires.
app.get("/api/chat/:swapId", (req, res) => {
  const { swapId } = req.params;
  const { username } = req.query;

  if (!username)
    return res
      .status(400)
      .json({ success: false, message: "username query param required" });

  verifySwapAccess(swapId, username, (err, swap) => {
    if (err)
      return res
        .status(err.code)
        .json({ success: false, message: err.message });

    const otherUser = swap.sender === username ? swap.receiver : swap.sender;

    db.all(
      `SELECT Messages.id, Messages.content, Messages.created_at, Messages.expires_at,
              Users.username AS sender
       FROM Messages
       JOIN Users ON Messages.sender_id = Users.id
       WHERE Messages.swap_id = ?
       ORDER BY Messages.created_at ASC`,
      [swapId],
      (err, messages) => {
        if (err)
          return res.status(500).json({ success: false, message: err.message });

        // Derive chat expiry from the oldest message's expires_at (all share the same window).
        // If no messages yet, it hasn't started — return null.
        const expiresAt = messages.length > 0 ? messages[0].expires_at : null;

        res.json({
          success: true,
          swapId: swap.id,
          otherUser,
          expiresAt,
          messages: messages || [],
        });
      },
    );
  });
});

// POST /api/chat/:swapId
// Body: { username, content }
// Sends a message. expires_at is set to 7 days from NOW for each message.
app.post("/api/chat/:swapId", (req, res) => {
  const { swapId } = req.params;
  const { username, content } = req.body;

  if (!username || !content || !content.trim())
    return res
      .status(400)
      .json({ success: false, message: "username and content are required" });

  verifySwapAccess(swapId, username, (err, swap) => {
    if (err)
      return res
        .status(err.code)
        .json({ success: false, message: err.message });

    db.get(`SELECT id FROM Users WHERE username=?`, [username], (err, user) => {
      if (err || !user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      db.run(
        `INSERT INTO Messages (swap_id, sender_id, content, expires_at)
         VALUES (?, ?, ?, datetime('now', '+7 days'))`,
        [swapId, user.id, content.trim()],
        function (err) {
          if (err)
            return res
              .status(500)
              .json({ success: false, message: err.message });
          res.json({ success: true, messageId: this.lastID });
        },
      );
    });
  });
});

// GET /api/chat/active/:username
// Returns all accepted swaps that have an active chat (i.e. at least one message),
// so the frontend knows which conversation threads to show in the chat panel.
app.get("/api/chat/active/:username", (req, res) => {
  const { username } = req.params;

  db.get(`SELECT id FROM Users WHERE username=?`, [username], (err, user) => {
    if (err || !user) return res.json({ success: false, chats: [] });

    db.all(
      `SELECT Swapps.id AS swapId,
              s.username AS sender,
              r.username AS receiver,
              (SELECT COUNT(*) FROM Messages WHERE swap_id = Swapps.id) AS messageCount,
              (SELECT MAX(created_at) FROM Messages WHERE swap_id = Swapps.id) AS lastMessageAt
       FROM Swapps
       JOIN Users s ON Swapps.sender_id = s.id
       JOIN Users r ON Swapps.receiver_id = r.id
       WHERE (Swapps.sender_id = ? OR Swapps.receiver_id = ?)
         AND Swapps.status = 'accepted'
       ORDER BY lastMessageAt DESC`,
      [user.id, user.id],
      (err, rows) => {
        if (err) return res.json({ success: false, chats: [] });

        const chats = (rows || []).map((row) => ({
          swapId: row.swapId,
          otherUser: row.sender === username ? row.receiver : row.sender,
          messageCount: row.messageCount,
          lastMessageAt: row.lastMessageAt,
        }));

        res.json({ success: true, chats });
      },
    );
  });
});

// ─── START ────────────────────────────────────────────────────────────────
initializeDatabase().then((success) => {
  if (success) {
    // Run cleanup immediately on startup, then every hour
    runChatCleanup();
    setInterval(runChatCleanup, 60 * 60 * 1000);

    app.listen(PORT, () =>
      console.log(`🚀 SWAPPR running at http://localhost:${PORT}`),
    );
  } else {
    console.error("❌ Failed to initialize database. Exiting.");
    process.exit(1);
  }
});
