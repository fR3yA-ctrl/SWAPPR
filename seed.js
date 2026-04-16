const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./swappr.db");

const USERS = [
  {
    name: "Ana Reyes",
    username: "ana_reyes",
    password: "pass1234",
    course: "BS Computer Science",
    studentId: "2021100001",
  },
  {
    name: "Marco Santos",
    username: "marco_s",
    password: "pass1234",
    course: "BS Information Technology",
    studentId: "2021100002",
  },
  {
    name: "Lia Cruz",
    username: "lia_cruz",
    password: "pass1234",
    course: "BS Electrical Engineering",
    studentId: "2020100003",
  },
  {
    name: "Josh Mendoza",
    username: "josh_m",
    password: "pass1234",
    course: "BS Mathematics",
    studentId: "2022100004",
  },
  {
    name: "Camille Tan",
    username: "cami_tan",
    password: "pass1234",
    course: "BS Psychology",
    studentId: "2021100005",
  },
  {
    name: "Renz Villanueva",
    username: "renz_v",
    password: "pass1234",
    course: "BS Computer Science",
    studentId: "2023100006",
  },
  {
    name: "Sofia dela Cruz",
    username: "sofia_dc",
    password: "pass1234",
    course: "BS Nursing",
    studentId: "2020100007",
  },
];

const NOTEBOOKS = [
  {
    author: "ana_reyes",
    title: "Data Structures & Algorithms",
    description: "Complete notes with examples in Python.",
    department: "BS Computer Science",
    file_url: "https://drive.google.com/example/ana-dsa",
  },
  {
    author: "ana_reyes",
    title: "Object-Oriented Programming",
    description: "OOP principles with Java walkthroughs.",
    department: "BS Computer Science",
    file_url: "https://drive.google.com/example/ana-oop",
  },
  {
    author: "marco_s",
    title: "Web Development Fundamentals",
    description: "HTML, CSS, and vanilla JS basics.",
    department: "BS Information Technology",
    file_url: "https://drive.google.com/example/marco-webdev",
  },
  {
    author: "marco_s",
    title: "Database Management Systems",
    description: "SQL queries, normalization, and ER diagrams.",
    department: "BS Information Technology",
    file_url: "https://drive.google.com/example/marco-dbms",
  },
  {
    author: "lia_cruz",
    title: "Circuit Analysis Notes",
    description: "KVL, KCL, Thevenin/Norton theorems.",
    department: "BS Electrical Engineering",
    file_url: "https://drive.google.com/example/lia-circuits",
  },
  {
    author: "josh_m",
    title: "Calculus I — Limits & Derivatives",
    description: "Detailed walkthrough of limits and differentiation.",
    department: "BS Mathematics",
    file_url: "https://drive.google.com/example/josh-calc1",
  },
  {
    author: "josh_m",
    title: "Linear Algebra",
    description: "Vectors, matrices, and eigenvalues.",
    department: "BS Mathematics",
    file_url: "https://drive.google.com/example/josh-linalg",
  },
  {
    author: "cami_tan",
    title: "Abnormal Psychology",
    description: "DSM-5 overview and case studies.",
    department: "BS Psychology",
    file_url: "https://drive.google.com/example/cami-abpsych",
  },
  {
    author: "renz_v",
    title: "Operating Systems",
    description: "Process scheduling and memory management.",
    department: "BS Computer Science",
    file_url: "https://drive.google.com/example/renz-os",
  },
  {
    author: "sofia_dc",
    title: "Fundamentals of Nursing",
    description: "Care planning and patient assessment.",
    department: "BS Nursing",
    file_url: "https://drive.google.com/example/sofia-nursing",
  },
];

const LIKES = [
  { liker: "marco_s", notebookIdx: 0 },
  { liker: "renz_v", notebookIdx: 0 },
  { liker: "josh_m", notebookIdx: 0 },
  { liker: "cami_tan", notebookIdx: 0 },
  { liker: "ana_reyes", notebookIdx: 2 },
  { liker: "lia_cruz", notebookIdx: 2 },
  { liker: "sofia_dc", notebookIdx: 2 },
  { liker: "ana_reyes", notebookIdx: 5 },
  { liker: "marco_s", notebookIdx: 5 },
  { liker: "ana_reyes", notebookIdx: 8 },
  { liker: "marco_s", notebookIdx: 8 },
];

const SWAPPS = [
  { from: "ana_reyes", to: "marco_s", status: "accepted" },
  { from: "josh_m", to: "lia_cruz", status: "accepted" },
  { from: "renz_v", to: "ana_reyes", status: "pending" },
  { from: "cami_tan", to: "sofia_dc", status: "pending" },
];

const run = (sql, params = []) =>
  new Promise((res, rej) =>
    db.run(sql, params, function (err) {
      err ? rej(err) : res(this);
    }),
  );
const get = (sql, params = []) =>
  new Promise((res, rej) =>
    db.get(sql, params, (err, row) => {
      err ? rej(err) : res(row);
    }),
  );

async function seed() {
  console.log("🌱 Starting fresh seed...");

  await run(`DROP TABLE IF EXISTS Users`);
  await run(`DROP TABLE IF EXISTS Notebooks`);
  await run(`DROP TABLE IF EXISTS Likes`);
  await run(`DROP TABLE IF EXISTS Swapps`);

  await run(
    `CREATE TABLE Users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, username TEXT UNIQUE, password TEXT, bio TEXT, course TEXT, department TEXT, yearLevel TEXT)`,
  );
  await run(
    `CREATE TABLE Notebooks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, department TEXT, author_id INTEGER, file_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  );
  await run(
    `CREATE TABLE Likes (user_id INTEGER, notebook_id INTEGER, PRIMARY KEY (user_id, notebook_id))`,
  );
  await run(
    `CREATE TABLE Swapps (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER, receiver_id INTEGER, status TEXT)`,
  );

  const userIds = {};
  for (const u of USERS) {
    const res = await run(
      `INSERT INTO Users (name, username, password, course, department, yearLevel) VALUES (?,?,?,?,?,?)`,
      [u.name, u.username, u.password, u.course, u.course, u.studentId],
    );
    userIds[u.username] = res.lastID;
  }
  console.log("👤 Users seeded.");

  const notebookIds = [];
  for (const nb of NOTEBOOKS) {
    const res = await run(
      `INSERT INTO Notebooks (title, description, department, author_id, file_url) VALUES (?,?,?,?,?)`,
      [
        nb.title,
        nb.description,
        nb.department,
        userIds[nb.author],
        nb.file_url,
      ],
    );
    notebookIds.push(res.lastID);
  }
  console.log("📓 Notebooks seeded.");

  for (const l of LIKES) {
    await run(
      `INSERT OR IGNORE INTO Likes (user_id, notebook_id) VALUES (?,?)`,
      [userIds[l.liker], notebookIds[l.notebookIdx]],
    );
  }
  console.log("❤️ Likes seeded.");

  for (const s of SWAPPS) {
    await run(
      `INSERT INTO Swapps (sender_id, receiver_id, status) VALUES (?,?,?)`,
      [userIds[s.from], userIds[s.to], s.status],
    );
  }
  console.log("⇄ Swapps seeded.\n✅ All set!");
  db.close();
}

seed().catch((err) => {
  console.error("❌ Error:", err.message);
  db.close();
});
