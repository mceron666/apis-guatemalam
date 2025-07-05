const express = require("express")
const sql = require("mssql") 
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
				CASE ROL_PERSONA WHEN 'A' THEN (SELECT TOP 1 P.ID_PERIODO_ESCOLAR
FROM PERIODOS_ESCOLARES P
INNER JOIN ALUMNOS_POR_GRADO A ON P.ID_PERIODO_ESCOLAR = A.ID_PERIODO_ESCOLAR
WHERE ID_ALUMNO = 8
ORDER BY FECHA_INICIO_PERIODO DESC) ELSE
                (SELECT ID_PERIODO_ESCOLAR from PERIODOS_ESCOLARES where YEAR(FECHA_INICIO_PERIODO) = YEAR('2025-01-01') ) END AS PERIODO_ESCOLAR, 
                YEAR(GETDATE()) AS ANIO_ACTUAL, 
				dbo.GRADO_ACTUAL(ID_ALUMNO) AS GRADO_ACTUAL
            FROM 
                VL_PERSONAL_ESCOLAR 
            WHERE 
                CORREO_PERSONA = @CORREO_O_PERFIL OR PERFIL_PERSONA = @CORREO_O_PERFIL
        `)

    res.status(200).json({
      mensaje: "",
      usuario: userData.recordset[0],
    })
  } catch (err) {
    res.status(500).json({ error: "Error en la autenticación", details: err.message })
  }
})

module.exports = router
