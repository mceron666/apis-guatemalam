import jwt from "jsonwebtoken"
import sql from "mssql" // Assuming mssql is used for database operations
import express from "express"

const router = express.Router()

router.post("/", async (req, res) => {
  const { CORREO_O_PERFIL, CLAVE_PERFIL } = req.body

  try {
    const request = new sql.Request()
    request.input("CORREO_O_PERFIL", sql.VarChar(50), CORREO_O_PERFIL)
    request.input("CLAVE_PERFIL", sql.VarChar(20), CLAVE_PERFIL)
    request.output("MENSAJE", sql.NVarChar(255))

    const result = await request.execute("PROCEDIMIENTO_LOGIN")
    const mensaje = result.output.MENSAJE || ""

    if (mensaje.trim() !== "") {
      return res.status(401).json({ mensaje: mensaje })
    }

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
        ID_PERIODO_ESCOLAR AS PERIODO_ESCOLAR, 
        CODIGO_PERIODO, 
        DESCRIPCION_PERIODO,
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

    const payload = {
      id: usuario.ID_PERSONA,
      correo: usuario.CORREO_PERSONA,
      rol: usuario.ROL_PERSONA,
      perfil: usuario.PERFIL_PERSONA,
    }

    const secretKey = process.env.JWT_SECRET || "tu_clave_secreta_aqui"
    const token = jwt.sign(payload, secretKey, {
      expiresIn: "1h", // Token válido por 1 hora
    })

    res.status(200).json({
      mensaje: "",
      usuario: usuario,
      token: token, // Incluir token en la respuesta
      expiresIn: 3600, // Indicar tiempo de expiración en segundos (1 hora)
    })
  } catch (err) {
    res.status(500).json({ error: "Error en la autenticación", details: err.message })
  }
})
