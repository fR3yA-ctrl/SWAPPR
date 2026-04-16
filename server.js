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
    console.log("✅ Database initialized!");
    return true;
  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
    return false;
  }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────
app.post("/api/register", (req, res) => {
  console.log("[REGISTER] Request received");
  console.log("[REGISTER] Body:", req.body);

  try {
    const { name, username, password, course, yearLevel } = req.body;

    // ✅ VALIDATION
    if (!name || !username || !password) {
      console.log("[REGISTER] Missing required fields");
      return res.status(400).json({
        error: "Name, username, and password are required",
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        error: "Username must be at least 3 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    console.log("[REGISTER] Processing:", { name, username });

    // ✅ CHECK IF USERNAME ALREADY EXISTS
    db.get(
      `SELECT id FROM Users WHERE username = ?`,
      [username],
      (err, existingUser) => {
        if (err) {
          console.error("[REGISTER] Database error (check existing):", err);
          return res.status(500).json({
            error: "Database error",
            message: err.message,
          });
        }

        if (existingUser) {
          console.log("[REGISTER] Username already exists:", username);
          return res.status(400).json({
            error: "Username already taken",
          });
        }

        // ✅ INSERT NEW USER
        console.log("[REGISTER] Creating user...");
        db.run(
          `INSERT INTO Users (name, username, password, course, department, yearLevel)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            name,
            username,
            password,
            course || "",
            course || "",
            yearLevel || "",
          ],
          function (err) {
            if (err) {
              console.error("[REGISTER] Insert error:", err);
              return res.status(500).json({
                error: "Registration failed",
                message: err.message,
              });
            }

            console.log(
              "[REGISTER] Success - User created with ID:",
              this.lastID,
            );
            res.status(201).json({
              success: true,
              message: "Registration successful",
              userId: this.lastID,
              user: {
                id: this.lastID,
                name,
                username,
                course: course || "",
                yearLevel: yearLevel || "",
              },
            });
          },
        );
      },
    );
  } catch (error) {
    console.error("[REGISTER] ERROR:", error.message);
    console.error("[REGISTER] Stack:", error.stack);

    res.status(500).json({
      error: "Registration failed",
      message: error.message,
    });
  }
});

app.post("/api/login", (req, res) => {
  console.log("[LOGIN] Request received");
  const { username, password } = req.body;

  console.log("[LOGIN] Attempting login for:", username);

  if (!username || !password) {
    console.log("[LOGIN] Missing username or password");
    return res.status(400).json({
      success: false,
      message: "Username and password required",
    });
  }

  db.get(
    `SELECT * FROM Users WHERE username = ? AND password = ?`,
    [username, password],
    (err, user) => {
      if (err) {
        console.error("[LOGIN] Database error:", err);
        return res.status(500).json({
          success: false,
          message: "Database error",
        });
      }

      if (!user) {
        console.log("[LOGIN] Invalid credentials for:", username);
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      console.log("[LOGIN] Success for:", username);
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          bio: user.bio || "",
          course: user.course || "",
          department: user.department || "",
          yearLevel: user.yearLevel || "",
        },
      });
    },
  );
});

// ─── USERS ────────────────────────────────────────────────────────────────
app.get("/api/users", (req, res) => {
  db.all(
    `SELECT id, name, username, bio, course, department, yearLevel FROM Users`,
    [],
    (err, users) => {
      if (err) return res.json({ success: false, message: err.message });
      res.json({ success: true, users });
    },
  );
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

// FIX: Missing PATCH /api/profile endpoint
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

// FIX: supports both delete-by-id and delete-by-title+author
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

// ─── START ────────────────────────────────────────────────────────────────
// ✅ WAIT for database to be ready before starting server
initializeDatabase().then((success) => {
  if (success) {
    app.listen(PORT, () =>
      console.log(`🚀 SWAPPR running at http://localhost:${PORT}`),
    );
  } else {
    console.error("❌ Failed to initialize database. Exiting.");
    process.exit(1);
  }
});
