const express = require("express")
const sql = require("mssql")
const cors = require("cors")
const jwt = require("jsonwebtoken")
require("dotenv").config()

const app = express()
const port = 3000
app.use(express.json())
app.use(cors())

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
}

// Conectar a SQL Server
sql
  .connect(dbConfig)
  .then(() => {
    console.log("✅ Conectado a SQL Server")
  })
  .catch((err) => {
    console.error("❌ Error de conexión a la base de datos:", err)
  })

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token de acceso requerido",
    })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Token inválido o expirado",
      })
    }
    req.user = user
    next()
  })
}

// Importar y usar las rutas
const periodosRoutes = require("./routes/periodos")
const carrerasRoutes = require("./routes/carreras")
const personasRoutes = require("./routes/personas")
const materiasRoutes = require("./routes/materias")
const gradosRoutes = require("./routes/grados")
const loginRoutes = require("./routes/login") // Login no requiere autenticación
const materiasgradoRoutes = require("./routes/materias-grado")
const alumnosgradoRoutes = require("./routes/alumnos-grado")
const bloquesRoutes = require("./routes/bloques")
const evaluacionesRoutes = require("./routes/evaluacion")
const notasRoutes = require("./routes/notas")
const calendarioRoutes = require("./routes/calendario")
const preciosRoutes = require("./routes/precios")
const pagosRoutes = require("./routes/pagos")
const pdfRoutes = require("./routes/pdf")
const institucionRoutes = require("./routes/institucion")
const eventosRoutes = require("./routes/eventos")

app.use("/periodos", authenticateToken, periodosRoutes)
app.use("/carreras", authenticateToken, carrerasRoutes)
app.use("/personas", authenticateToken, personasRoutes)
app.use("/materias", authenticateToken, materiasRoutes)
app.use("/grados", authenticateToken, gradosRoutes)
app.use("/login", loginRoutes) // Login no requiere autenticación

app.get("/verify-token", authenticateToken, (req, res) => {
  // Si llegamos aquí, el token es válido (pasó por authenticateToken)
  res.json({
    success: true,
    message: "Token válido",
    user: req.user,
  })
})

app.use("/materias-grado", authenticateToken, materiasgradoRoutes)
app.use("/alumnos-grado", authenticateToken, alumnosgradoRoutes)
app.use("/bloques", authenticateToken, bloquesRoutes)
app.use("/evaluaciones", authenticateToken, evaluacionesRoutes)
app.use("/notas", authenticateToken, notasRoutes)
app.use("/calendario", authenticateToken, calendarioRoutes)
app.use("/precios", authenticateToken, preciosRoutes)
app.use("/pagos", authenticateToken, pagosRoutes)
app.use("/pdf", pdfRoutes)
app.use("/institucion", authenticateToken, institucionRoutes)
app.use("/eventos", authenticateToken, eventosRoutes)

// Iniciar el servidor
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`)
})
