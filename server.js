const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- MongoDB ---
mongoose.connect(
  "mongodb+srv://sa0653286:sa0653286@gmail@sa0653286.z7tyl9v.mongodb.net/chatflowDB?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  contacts: [String],
});

const messageSchema = new mongoose.Schema({
  from: String,
  to: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

const SECRET = "chatflowsecret";

// --- Signup ---
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const existing = await User.findOne({ username });
  if (existing) return res.json({ success: false, message: "Email already exists" });
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, password: hashed, contacts: [] });
  res.json({ success: true, message: "Signup successful" });
});

// --- Login ---
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.json({ success: false, message: "Invalid credentials" });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ success: false, message: "Invalid credentials" });
  const token = jwt.sign({ username }, SECRET, { expiresIn: "7d" });
  res.json({ success: true, message: "Login successful", token });
});

// --- Auth middleware ---
function auth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ success: false, message: "Unauthorized" });
  const token = header.split(" ")[1];
  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: "Unauthorized" });
    req.username = decoded.username;
    next();
  });
}

// --- Get user info ---
app.get("/loginInfo", auth, async (req, res) => {
  res.json({ username: req.username });
});

// --- Contacts ---
app.get("/contacts", auth, async (req, res) => {
  const user = await User.findOne({ username: req.username });
  res.json({ contacts: user.contacts });
});

app.post("/contacts", auth, async (req, res) => {
  const { contact } = req.body;
  const user = await User.findOne({ username: req.username });
  if (!user.contacts.includes(contact)) user.contacts.push(contact);
  await user.save();
  res.json({ success: true });
});

// --- Messages ---
app.get("/messages/:contact", auth, async (req, res) => {
  const msgs = await Message.find({ 
    $or: [
      { from: req.username, to: req.params.contact },
      { from: req.params.contact, to: req.username }
    ]
  }).sort({ createdAt: 1 });
  res.json({ messages: msgs });
});

app.post("/messages", auth, async (req, res) => {
  const { to, text } = req.body;
  const msg = await Message.create({ from: req.username, to, text });
  io.emit("receive_message", msg);
  res.json({ success: true });
});

// --- Socket.IO ---
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));