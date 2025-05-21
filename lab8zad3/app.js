const express = require('express');
const redis = require('redis');
const { Pool } = require('pg');

const app = express();
app.use(express.json());


const redisClient = redis.createClient({
  host: 'redis-server',  
  port: 6379
});

redisClient.on('error', (err) => {
  console.error('Błąd połączenia z Redis:', err);
});


const pgPool = new Pool({
  user: 'admin', 
  host: 'postgres-db', 
  database: 'mydatabase', 
  password: 'password', 
  port: 5432,
});

pgPool.on('connect', () => {
  console.log('Połączono z PostgreSQL');
  pgPool.query('CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) NOT NULL)', (err, res) => {
    if (err) {
      console.error('Błąd podczas tworzenia tabeli users:', err);
    } else {
      console.log('Tabela users gotowa lub już istniała.');
    }
  });
});

pgPool.on('error', (err) => {
  console.error('Błąd połączenia z PostgreSQL:', err);
});


app.post('/messages', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).send('Wiadomość jest wymagana');
  }
  redisClient.rpush('messages', message, (err, reply) => {
    if (err) {
      console.error('Błąd podczas zapisywania wiadomości do Redis:', err);
      return res.status(500).send('Błąd serwera podczas zapisywania wiadomości');
    }
    res.status(201).send({ status: 'Wiadomość dodana', id: reply });
  });
});

app.get('/messages', (req, res) => {

  redisClient.lrange('messages', 0, -1, (err, messages) => {
    if (err) {
      console.error('Błąd podczas odczytywania wiadomości z Redis:', err);
      return res.status(500).send('Błąd serwera podczas odczytywania wiadomości');
    }
    res.status(200).send(messages);
  });
});

app.post('/users', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).send('Nazwa użytkownika jest wymagana');
  }
  try {
    const result = await pgPool.query('INSERT INTO users (username) VALUES ($1) RETURNING id', [username]);
    res.status(201).send({ status: 'Użytkownik dodany', userId: result.rows[0].id });
  } catch (err) {
    console.error('Błąd podczas dodawania użytkownika do PostgreSQL:', err);
    res.status(500).send('Błąd serwera podczas dodawania użytkownika');
  }
});

app.get('/users', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT id, username FROM users');
    res.status(200).send(result.rows);
  } catch (err) {
    console.error('Błąd podczas odczytywania użytkowników z PostgreSQL:', err);
    res.status(500).send('Błąd serwera podczas odczytywania użytkowników');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serwer Express działa na porcie ${PORT}`);
});