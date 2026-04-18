const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

console.log(" SERVER STARTING...");

const db = new sqlite3.Database("./swappr.db", (err) => {
  if (err) console.error(err.message);
  console.log("Connected to SQLite database.");
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function initDB() {
  await run(`CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    password TEXT,
    bio TEXT,
    course TEXT,
    department TEXT,
    yearLevel TEXT
  )`);

  console.log("✅ DB ready");
}

app.post("/api/register", (req, res) => {
  console.log("[REGISTER]", req.body);

  const { name, username, password, course, yearLevel } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  db.get("SELECT id FROM Users WHERE username = ?", [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });

    if (user) {
      return res.status(400).json({ error: "Username exists" });
    }

    db.run(
      `INSERT INTO Users (name, username, password, course, department, yearLevel)
   VALUES (?, ?, ?, ?, ?, ?)`,
      [name, username, password, course || "", course || "", yearLevel || ""],
      function (err) {
        if (err) {
          console.error("🔥 REGISTER SQL ERROR:", err); // ADD THIS
          return res.status(500).json({
            error: err.message, // IMPORTANT
          });
        }

        console.log("[REGISTER] Success");
        res.json({ success: true });
      },
    );
  });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM Users WHERE username = ? AND password = ?",
    [username, password],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: "Invalid login" });

      res.json({ success: true, user });
    },
  );
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Running: http://localhost:${PORT}`);
  });
});
