const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./db/users.db');

function generateRandomHistory() {
  // 12 valores aleatórios entre 20 e 100 (kWh)
  return JSON.stringify(Array.from({length: 12}, () => Math.floor(Math.random() * 81) + 20));
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      apelido TEXT NOT NULL,
      data_nascimento TEXT NOT NULL,
      genero TEXT NOT NULL,
      cartao_cidadao TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      telefone TEXT NOT NULL,
      morada TEXT NOT NULL,
      pais TEXT NOT NULL,
      cidade TEXT NOT NULL,
      codigo_postal TEXT NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      saldo REAL NOT NULL,
      monthly_history TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Insere admin se não existir
  db.run(`
    INSERT OR IGNORE INTO users 
      (nome, apelido, data_nascimento, genero, cartao_cidadao, email, telefone, morada, pais, cidade, codigo_postal, password, is_admin)
    VALUES 
      ('Administrador', 'Admin', '1970-01-01', 'Outro', '00000000', 'admin@multipower.pt', '000000000', 'Admin Street', 'Portugal', 'Aveiro', '0000-000', 'admin123', 1)
  `);

  // Cria carteiras para todos os utilizadores que ainda não têm
  db.all(`SELECT id FROM users`, [], (err, users) => {
    if (users && users.length > 0) {
      let pending = users.length;
      users.forEach(user => {
        db.run(`
          INSERT OR IGNORE INTO wallets (user_id, saldo, monthly_history)
          VALUES (?, ?, ?)
        `, [user.id, (Math.random() * 200).toFixed(2), generateRandomHistory()], () => {
          pending--;
          if (pending === 0) db.close();
        });
      });
    } else {
      db.close();
    }
  });
});