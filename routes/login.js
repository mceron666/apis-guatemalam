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
				ID_PERIODO_ESCOLAR AS PERIODO_ESCOLAR, 
				CODIGO_PERIODO, 
				DESCRIPCION_PERIODO,
                YEAR(GETDATE()) AS ANIO_ACTUAL, 
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
                (SELECT ID_PERIODO_ESCOLAR from PERIODOS_ESCOLARES where YEAR(FECHA_INICIO_PERIODO) = YEAR(GETDATE()) ) END
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

router.post('/crear-clave', async (req, res) => {
  const { ID_PERSONA, NUEVA_CLAVE } = req.body;

  try {
    const request = new sql.Request();
    request.input('ID_PERSONA', sql.Int, ID_PERSONA);
    request.input('NUEVA_CLAVE', sql.NVarChar(64), NUEVA_CLAVE);
    request.output('MENSAJE', sql.NVarChar(255));

    const result = await request.execute('CREAR_CLAVE_PERFIL');
    const mensaje = result.output.MENSAJE || '';

    res.status(200).json({ mensaje });
  } catch (err) {
    res.status(500).json({
      error: 'Error ejecutando el procedimiento',
      details: err.message
    });
  }
});

router.post('/setea-clave', async (req, res) => {
  const { PERFIL_PERSONA } = req.body;

  try {
    const request = new sql.Request();
    request.input('PERFIL_PERSONA', sql.Char, PERFIL_PERSONA);

    const result = await request.execute('SETEA_PASSWORD');
    res.status(200).json({  });
  } catch (err) {
    res.status(500).json({
      error: 'Error ejecutando el procedimiento',
      details: err.message
    });
  }
});

router.post('/cambiar-perfil', async (req, res) => {
  const {
    ID_PERSONA,
    NOMBRES_PERSONA,
    APELLIDOS_PERSONA,
    CORREO_PERSONA,
    NUMERO_PERSONA,
    NUEVA_CLAVE // este es opcional
  } = req.body;

  try {
    const request = new sql.Request();
    request.input('ID_PERSONA', sql.Int, ID_PERSONA);
    request.input('NOMBRES_PERSONA', sql.VarChar(50), NOMBRES_PERSONA);
    request.input('APELLIDOS_PERSONA', sql.VarChar(50), APELLIDOS_PERSONA);
    request.input('CORREO_PERSONA', sql.VarChar(50), CORREO_PERSONA);
    request.input('NUMERO_PERSONA', sql.VarChar(15), NUMERO_PERSONA);
    request.input('NUEVA_CLAVE', sql.NVarChar(64), NUEVA_CLAVE || null);
    request.output('MENSAJE', sql.NVarChar(255));

    const result = await request.execute('PROCEDIMIENTO_CAMBIAR_PERFIL');

    res.status(200).json({
      mensaje: result.output.MENSAJE
    });
  } catch (err) {
    res.status(500).json({
      error: 'Error ejecutando el procedimiento',
      details: err.message
    });
  }
});


module.exports = router
