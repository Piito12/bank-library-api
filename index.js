require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify JWT
function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access Denied' });
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Invalid Token' });
        req.user = decoded;
        next();
    });
}

// User login (Generate JWT)
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "password") {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "1h" });
        return res.json({ token });
    }
    res.status(401).json({ error: "Invalid credentials" });
});

// Add a Book
app.post('/books', verifyToken, async (req, res) => {
    const { title, author, isbn, published_year } = req.body;
    const result = await pool.query(
        'INSERT INTO books (title, author, isbn, published_year) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, author, isbn, published_year]
    );
    res.status(201).json(result.rows[0]);
});

// Update a Book
app.put('/books/:id', verifyToken, async (req, res) => {
    const { title, author, isbn, published_year } = req.body;
    const { id } = req.params;
    const result = await pool.query(
        'UPDATE books SET title=$1, author=$2, isbn=$3, published_year=$4 WHERE id=$5 RETURNING *',
        [title, author, isbn, published_year, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Book not found' });
    res.json(result.rows[0]);
});

// Delete a Book
app.delete('/books/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM books WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Book not found' });
    res.status(204).send();
});

// Search Books
app.get('/books', verifyToken, async (req, res) => {
    const { title, author, isbn } = req.query;
    const conditions = [];
    const values = [];
    let query = 'SELECT * FROM books';
    
    if (title) { conditions.push(`title ILIKE $${values.length + 1}`); values.push(`%${title}%`); }
    if (author) { conditions.push(`author ILIKE $${values.length + 1}`); values.push(`%${author}%`); }
    if (isbn) { conditions.push(`isbn = $${values.length + 1}`); values.push(isbn); }
    
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    const result = await pool.query(query, values);
    res.json(result.rows);
});

app.get('/test', (req, res) => {
    console.log('Test');
    res.json({ message: 'Test' });
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
