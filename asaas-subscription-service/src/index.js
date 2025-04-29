const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Rotas
const asaasRoutes = require('./routes/asaas.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const userRoutes = require('./routes/user.routes');

// Configuração
dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Saúde da API
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Asaas Subscription Service API is running' });
});

// Configuração das rotas
app.use('/api/asaas', asaasRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/users', userRoutes);

// Conexão com o MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Inicializar o servidor
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer(); 