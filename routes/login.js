const express = require("express")
const sql = require("mssql")
const jwt = require("jsonwebtoken") // Agregando importación de jsonwebtoken
const router = express.Router()

router.post("/", async (req, res) => {
  const { CORREO_O_PERFIL, CLAVE_PERFIL, IP_ACCESO, DISPOSITIVO_ACCEDE, LUGAR_ACCESO, LATITUD, LONGITUD } = req.body

  try {
    // 1. Ejecutar procedimiento de login
    const request = new sql.Request()
    request.input("CORREO_O_PERFIL", sql.VarChar(50), CORREO_O_PERFIL)
    request.input("CLAVE_PERFIL", sql.VarChar(20), CLAVE_PERFIL)
    request.output("MENSAJE", sql.NVarChar(255))

    const result = await request.execute("PROCEDIMIENTO_LOGIN")
    const mensaje = result.output.MENSAJE || ""

    // 2. Si hay mensaje, significa que el login falló
    if (mensaje.trim() !== "") {
      return res.status(401).json({ mensaje })
    }

    // 3. Obtener datos del usuario
    const userQuery = new sql.Request()
    userQuery.input("CORREO_O_PERFIL", sql.VarChar(50), CORREO_O_PERFIL)

    const userData = await userQuery.query(`
      SELECT 
        ID_PERSONA, 
        NOMBRES_PERSONA, 
        APELLIDOS_PERSONA, 
        PERFIL_PERSONA,
        CORREO_PERSONA,
        ROL_PERSONA, 
        ID_ALUMNO,
        P.ID_PERIODO_ESCOLAR AS PERIODO_ESCOLAR, 
        P.CODIGO_PERIODO, 
        P.DESCRIPCION_PERIODO,
        (SELECT TOP 1 YEAR(FECHA_INICIO_PERIODO) FROM PERIODOS_ESCOLARES ORDER BY FECHA_INICIO_PERIODO DESC) 
        AS ANIO_ACTUAL, 
        dbo.GRADO_ACTUAL(ID_ALUMNO) AS GRADO_ACTUAL, 
        DEBE_CAMBIAR_PASSWORD, 
        TIENE_CLAVE
      FROM 
        VL_PERSONAL_ESCOLAR V
      LEFT JOIN PERIODOS_ESCOLARES P
      ON P.ID_PERIODO_ESCOLAR = CASE ROL_PERSONA WHEN 'A' THEN (SELECT TOP 1 P.ID_PERIODO_ESCOLAR
        FROM PERIODOS_ESCOLARES P
        INNER JOIN ALUMNOS_POR_GRADO A ON P.ID_PERIODO_ESCOLAR = A.ID_PERIODO_ESCOLAR AND A.ID_ALUMNO = V.ID_ALUMNO
        ORDER BY FECHA_INICIO_PERIODO DESC) ELSE
        (SELECT ID_PERIODO_ESCOLAR from PERIODOS_ESCOLARES where YEAR(FECHA_INICIO_PERIODO) = 
        (SELECT TOP 1 YEAR(FECHA_INICIO_PERIODO) FROM PERIODOS_ESCOLARES ORDER BY FECHA_INICIO_PERIODO DESC)  ) END
      WHERE 
        CORREO_PERSONA = @CORREO_O_PERFIL OR PERFIL_PERSONA = @CORREO_O_PERFIL
    `)

    const usuario = userData.recordset[0]

    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" })
    }

    const payload = {
      id: usuario.ID_PERSONA,
      correo: usuario.CORREO_PERSONA,
      rol: usuario.ROL_PERSONA,
      perfil: usuario.PERFIL_PERSONA,
    }

    const secretKey = process.env.JWT_SECRET || "tu_clave_secreta_aqui"
    const token = jwt.sign(payload, secretKey, { expiresIn: "1h" })

    const logQuery = new sql.Request()
    logQuery.input("NUMERO_TOKEN", sql.VarChar(500), token) // Using JWT token instead of GUID, changed to VarChar with sufficient length
    logQuery.input("ID_PERSONA", sql.Int, usuario.ID_PERSONA)
    logQuery.input("DISPOSITIVO_ACCEDE", sql.VarChar(200), DISPOSITIVO_ACCEDE || req.headers["user-agent"] || null)
    logQuery.input("IP_ACCESO", sql.VarChar(50), IP_ACCESO || req.ip || null)
    logQuery.input("LUGAR_ACCESO", sql.VarChar(200), LUGAR_ACCESO || null)
    logQuery.input("LATITUD", sql.Decimal(9, 6), LATITUD || null)
    logQuery.input("LONGITUD", sql.Decimal(9, 6), LONGITUD || null)

    await logQuery.query(`
      INSERT INTO CONTROL_LOGIN (
        NUMERO_TOKEN, ID_PERSONA, DISPOSITIVO_ACCEDE, IP_ACCESO, LUGAR_ACCESO, LATITUD, LONGITUD
      ) 
      VALUES (
        @NUMERO_TOKEN, @ID_PERSONA, @DISPOSITIVO_ACCEDE, @IP_ACCESO, @LUGAR_ACCESO, @LATITUD, @LONGITUD
      )
    `)

    res.status(200).json({
      mensaje: "",
      usuario,
      token, // JWT for authentication
      expiresIn: 3600,
    })
  } catch (err) {
    console.error("Error en el login:", err)
    res.status(500).json({ error: "Error en la autenticación", details: err.message })
  }
})

router.post("/crear-clave", async (req, res) => {
  const { ID_PERSONA, NUEVA_CLAVE } = req.body

  try {
    const request = new sql.Request()
    request.input("ID_PERSONA", sql.Int, ID_PERSONA)
    request.input("NUEVA_CLAVE", sql.NVarChar(64), NUEVA_CLAVE)
    request.output("MENSAJE", sql.NVarChar(255))

    const result = await request.execute("CREAR_CLAVE_PERFIL")
    const mensaje = result.output.MENSAJE || ""

    res.status(200).json({ mensaje })
  } catch (err) {
    res.status(500).json({
      error: "Error ejecutando el procedimiento",
      details: err.message,
    })
  }
})

router.post("/setea-clave", async (req, res) => {
  const { PERFIL_PERSONA } = req.body

  try {
    const request = new sql.Request()
    request.input("PERFIL_PERSONA", sql.Char, PERFIL_PERSONA)

    const result = await request.execute("SETEA_PASSWORD")
    res.status(200).json({})
  } catch (err) {
    res.status(500).json({
      error: "Error ejecutando el procedimiento",
      details: err.message,
    })
  }
})

router.post("/cambiar-perfil", async (req, res) => {
  const {
    ID_PERSONA,
    NOMBRES_PERSONA,
    APELLIDOS_PERSONA,
    CORREO_PERSONA,
    NUMERO_PERSONA,
    NUEVA_CLAVE, // este es opcional
  } = req.body

  try {
    const request = new sql.Request()
    request.input("ID_PERSONA", sql.Int, ID_PERSONA)
    request.input("NOMBRES_PERSONA", sql.VarChar(50), NOMBRES_PERSONA)
    request.input("APELLIDOS_PERSONA", sql.VarChar(50), APELLIDOS_PERSONA)
    request.input("CORREO_PERSONA", sql.VarChar(50), CORREO_PERSONA)
    request.input("NUMERO_PERSONA", sql.VarChar(15), NUMERO_PERSONA)
    request.input("NUEVA_CLAVE", sql.NVarChar(64), NUEVA_CLAVE || null)
    request.output("MENSAJE", sql.NVarChar(255))

    const result = await request.execute("PROCEDIMIENTO_CAMBIAR_PERFIL")

    res.status(200).json({
      mensaje: result.output.MENSAJE,
    })
  } catch (err) {
    res.status(500).json({
      error: "Error ejecutando el procedimiento",
      details: err.message,
    })
  }
})

module.exports = router
