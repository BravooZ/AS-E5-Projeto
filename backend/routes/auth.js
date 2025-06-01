const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

const db = new sqlite3.Database('./db/users.db');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, user) => {
        if (err) return res.status(500).json({ error: 'Erro no servidor' });
        if (!user) return res.status(401).json({ error: 'Membro não encontrado' });
        res.json({ id: user.id, email: user.email, nome: user.nome, is_admin: !!user.is_admin });
    }
  );
});

router.post('/register', (req, res) => {
    const {
        nome, apelido, data_nascimento, genero, cartao_cidadao,
        email, telefone, morada, pais, cidade, codigo_postal, password
    } = req.body;

    if (!nome || !apelido || !data_nascimento || !genero || !cartao_cidadao ||
        !email || !telefone || !morada || !pais || !cidade || !codigo_postal || !password) {
        return res.status(400).json({ error: 'Campos obrigatórios em falta' });
    }

    db.run(
        `INSERT INTO users 
        (nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal, password, is_admin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal, password],
        function (err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(409).json({ error: 'Email já registado' });
                }
                return res.status(500).json({ error: 'Erro no servidor' });
            }
            // Cria carteira para o novo utilizador
            const userId = this.lastID;
            const saldo = (Math.random() * 200).toFixed(2);
            const monthly_history = JSON.stringify(Array.from({ length: 12 }, () => Math.floor(Math.random() * 81) + 20));
            db.run(
                `INSERT INTO wallets (user_id, saldo, monthly_history) VALUES (?, ?, ?)`,
                [userId, saldo, monthly_history],
                function (err2) {
                    if (err2) {
                        return res.status(500).json({ error: 'Erro ao criar carteira' });
                    }
                    res.status(201).json({ id: userId, email });
                }
            );
        }
    );
    // console.log(req.body); // (opcional para debug)
});

router.get('/wallet/:email', (req, res) => {
    const email = req.params.email;
    db.get(
        `SELECT w.saldo, w.monthly_history 
         FROM wallets w
         JOIN users u ON w.user_id = u.id
         WHERE u.email = ?`,
        [email],
        (err, wallet) => {
            if (err) return res.status(500).json({ error: 'Erro no servidor' });
            if (!wallet) return res.status(404).json({ error: 'Carteira não encontrada' });
            res.json({
                saldo: wallet.saldo,
                monthly_history: JSON.parse(wallet.monthly_history)
            });
        }
    );
});

router.get('/user/:email', (req, res) => {
    const email = req.params.email;
    db.get(
        `SELECT nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal 
         FROM users WHERE email = ?`,
        [email],
        (err, user) => {
            if (err) return res.status(500).json({ error: 'Erro no servidor' });
            if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' });
            res.json(user);
        }
    );
});

// Atualizar dados do utilizador (exceto password)
router.put('/user/update', (req, res) => {
    const { email, telefone, morada, cidade, codigo_postal, pais, old_email } = req.body;
    db.run(
        `UPDATE users SET email=?, telefone=?, morada=?, cidade=?, codigo_postal=?, pais=? WHERE email=?`,
        [email, telefone, morada, cidade, codigo_postal, pais, old_email],
        function (err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar dados' });
            res.json({ success: true });
        }
    );
});

// Atualizar password
router.put('/user/password', (req, res) => {
    const { email, password } = req.body;
    db.run(
        `UPDATE users SET password=? WHERE email=?`,
        [password, email],
        function (err) {
            if (err) return res.status(500).json({ error: 'Erro ao atualizar password' });
            res.json({ success: true });
        }
    );
});

// Tabela para histórico de carregamentos (se ainda não existir, cria em init_db.js)
db.run(`
    CREATE TABLE IF NOT EXISTS carregamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        valor REAL NOT NULL,
        data_hora TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
`);

// Adicionar saldo e registar carregamento
router.post('/wallet/add', (req, res) => {
    const { email, valor } = req.body;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.run('UPDATE wallets SET saldo = saldo + ? WHERE user_id = ?', [valor, user.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Erro ao adicionar saldo' });
            // Regista carregamento
            const data_hora = new Date().toISOString();
            db.run('INSERT INTO carregamentos (user_id, valor, data_hora) VALUES (?, ?, ?)', [user.id, valor, data_hora]);
            res.json({ success: true });
        });
    });
});

// Obter histórico de carregamentos
router.get('/carregamentos/:email', (req, res) => {
    const email = req.params.email;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.all('SELECT valor, data_hora FROM carregamentos WHERE user_id = ? ORDER BY data_hora DESC', [user.id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: 'Erro ao obter carregamentos' });
            res.json(rows);
        });
    });
});

module.exports = router;
