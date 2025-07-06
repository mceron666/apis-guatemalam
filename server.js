const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;
app.use(express.json()); 
app.use(cors());

// Configuración de la base de datos
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
};

// Conectar a SQL Server
sql.connect(dbConfig).then(() => {
    console.log('✅ Conectado a SQL Server');
}).catch(err => {
    console.error('❌ Error de conexión a la base de datos:', err);
});

// Importar y usar las rutas
const periodosRoutes = require('./routes/periodos');
const carrerasRoutes = require('./routes/carreras');
const personasRoutes = require('./routes/personas');
const materiasRoutes = require('./routes/materias');
const gradosRoutes = require('./routes/grados');
const loginRoutes = require('./routes/login');
const materiasgradoRoutes = require('./routes/materias-grado');
const alumnosgradoRoutes = require('./routes/alumnos-grado');
const bloquesRoutes = require('./routes/bloques');
const evaluacionesRoutes = require('./routes/evaluacion');
const notasRoutes = require('./routes/notas');
const calendarioRoutes = require('./routes/calendario');
const preciosRoutes = require('./routes/precios');
const pagosRoutes = require('./routes/pagos');
const pdfRoutes = require('./routes/pdf'); // nuevo archivo


app.use('/periodos', periodosRoutes);
app.use('/carreras', carrerasRoutes);
app.use('/personas', personasRoutes);
app.use('/materias', materiasRoutes);
app.use('/grados', gradosRoutes);
app.use('/login', loginRoutes);
app.use('/materias-grado', materiasgradoRoutes);
app.use('/alumnos-grado', alumnosgradoRoutes);
app.use('/bloques', bloquesRoutes);
app.use('/evaluaciones', evaluacionesRoutes);
app.use('/notas', notasRoutes);
app.use('/calendario', calendarioRoutes);
app.use('/precios', preciosRoutes);
app.use('/pagos', pagosRoutes);
app.use('/pdf', pdfRoutes);

// Iniciar el servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
