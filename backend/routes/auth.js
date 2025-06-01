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

// Adicionar saldo e registar carregamento (apenas se for input do utilizador)
router.post('/wallet/add', (req, res) => {
    const { email, valor, registar } = req.body;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.run('UPDATE wallets SET saldo = saldo + ? WHERE user_id = ?', [valor, user.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Erro ao adicionar saldo' });
            // Só regista carregamento se registar=true
            if (registar) {
                const data_hora = new Date().toISOString();
                db.run('INSERT INTO carregamentos (user_id, valor, data_hora) VALUES (?, ?, ?)', [user.id, valor, data_hora]);
            }
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

// Adicionar carro
router.post('/carros/add', (req, res) => {
    const { email, marca, modelo, ano, matricula, cor } = req.body;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.run(
            `INSERT INTO carros (user_id, marca, modelo, ano, matricula, cor) VALUES (?, ?, ?, ?, ?, ?)`,
            [user.id, marca, modelo, ano, matricula, cor],
            function (err2) {
                if (err2) return res.status(500).json({ error: 'Erro ao adicionar carro' });
                res.json({ success: true });
            }
        );
    });
});

// Listar carros do utilizador
router.get('/carros/:email', (req, res) => {
    const email = req.params.email;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.all('SELECT id, marca, modelo, ano, matricula, cor FROM carros WHERE user_id = ?', [user.id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: 'Erro ao obter carros' });
            res.json(rows);
        });
    });
});

// Remover carro
router.delete('/carros/remove', (req, res) => {
    const { email, carro_id } = req.body;
    db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Utilizador não encontrado' });
        db.run('DELETE FROM carros WHERE id = ? AND user_id = ?', [carro_id, user.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Erro ao remover carro' });
            res.json({ success: true });
        });
    });
});

// Associar estação ao carro
router.post('/carro_estacao/add', (req, res) => {
  const { carro_id, estacao_id, status, data, hora, lat, lon, endereco } = req.body;
  // Só pode haver uma estação por carro
  db.run(
    `INSERT OR REPLACE INTO carro_estacao (carro_id, estacao_id, status, data, hora, lat, lon, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [carro_id, estacao_id, status, data, hora, lat, lon, endereco],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao associar estação' });
      res.json({ success: true });
    }
  );
});

// Remover associação
router.post('/carro_estacao/remove', (req, res) => {
  const { carro_id, estacao_id } = req.body;
  db.run(
    `DELETE FROM carro_estacao WHERE carro_id = ? AND estacao_id = ?`,
    [carro_id, estacao_id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao remover associação' });
      res.json({ success: true });
    }
  );
});

// Obter estação associada ao carro
router.get('/carro_estacao/:carro_id', (req, res) => {
  const carro_id = req.params.carro_id;
  db.get(
    `SELECT * FROM carro_estacao WHERE carro_id = ?`,
    [carro_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Erro ao obter associação' });
      res.json(row);
    }
  );
});

// Endpoint ADMIN: Listar reservas/carregamentos por estação
router.get('/admin/estacoes', (req, res) => {
  // Junta reservas/carregamentos, carros e usuários
  db.all(`
    SELECT ce.estacao_id, ce.status, ce.data, ce.hora, ce.lat, ce.lon, ce.endereco,
           c.marca, c.modelo, c.ano, c.matricula, c.cor,
           u.nome, u.apelido, u.email
    FROM carro_estacao ce
    JOIN carros c ON ce.carro_id = c.id
    JOIN users u ON c.user_id = u.id
    ORDER BY ce.estacao_id, ce.data DESC, ce.hora DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao obter reservas/carregamentos' });
    // Agrupa por estacao_id
    const resultado = {};
    rows.forEach(r => {
      if (!resultado[r.estacao_id]) resultado[r.estacao_id] = [];
      resultado[r.estacao_id].push({
        status: r.status,
        data: r.data,
        hora: r.hora,
        lat: r.lat,
        lon: r.lon,
        endereco: r.endereco,
        carro: { marca: r.marca, modelo: r.modelo, ano: r.ano, matricula: r.matricula, cor: r.cor },
        usuario: { nome: r.nome, apelido: r.apelido, email: r.email }
      });
    });
    res.json(resultado);
  });
});

// Endpoint ADMIN: Reservas/carregamentos de uma estação específica
router.get('/admin/estacao/:estacao_id', (req, res) => {
  const estacao_id = req.params.estacao_id;
  db.all(`
    SELECT ce.status, ce.data, ce.hora, ce.lat, ce.lon, ce.endereco,
           c.marca, c.modelo, c.ano, c.matricula, c.cor,
           u.nome, u.apelido, u.email
    FROM carro_estacao ce
    JOIN carros c ON ce.carro_id = c.id
    JOIN users u ON c.user_id = u.id
    WHERE ce.estacao_id = ?
    ORDER BY ce.data DESC, ce.hora DESC
  `, [estacao_id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao obter reservas/carregamentos' });
    res.json(rows);
  });
});

module.exports = router;
