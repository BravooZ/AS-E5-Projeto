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

module.exports = router;
