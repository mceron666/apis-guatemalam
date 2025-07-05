const express = require('express');
const sql = require('mssql');

const router = express.Router();
router.post('/filtrar', async (req, res) => {
    const { ID_ALUMNO, ID_PERIODO_ESCOLAR } = req.body;

    // Validación de parámetros requeridos
    if (!ID_ALUMNO || !ID_PERIODO_ESCOLAR) {
        return res.status(400).json({
            error: 'Los parámetros ID_ALUMNO e ID_PERIODO_ESCOLAR son obligatorios.'
        });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input('ID_ALUMNO', sql.Int, ID_ALUMNO);
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);

        const query = `
            SELECT 
                CASE TIPO_PAGO 
                    WHEN 'M' THEN 'Mensualidad' 
                    ELSE 'Inscripción' 
                END AS TIPO_PAGO_DESC,
                CASE MES_DE_PAGO 
                    WHEN 1 THEN 'Enero'
                    WHEN 2 THEN 'Febrero'
                    WHEN 3 THEN 'Marzo'
                    WHEN 4 THEN 'Abril'
                    WHEN 5 THEN 'Mayo'
                    WHEN 6 THEN 'Junio'
                    WHEN 7 THEN 'Julio'
                    WHEN 8 THEN 'Agosto'
                    WHEN 9 THEN 'Septiembre'
                    WHEN 10 THEN 'Octubre'
                    ELSE NULL
                END AS DESCRIPCION_DE_MES, 
                MONTO_PAGADO, 
                FECHA_PAGO, 
                DESCRIPCION_PERIODO
            FROM PAGOS_COLEGIATURA C
            INNER JOIN VL_PERIODOS_ESCOLARES P
                ON C.ID_PERIODO_ESCOLAR = P.ID_PERIODO_ESCOLAR
            WHERE C.ID_ALUMNO = @ID_ALUMNO
              AND C.ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR
            ORDER BY MES_DE_PAGO;
        `;

        const result = await request.query(query);
        res.json(result.recordset);

    } catch (err) {
        res.status(500).json({
            error: 'Error al obtener los pagos del alumno',
            details: err.message
        });
    }
});
router.post('/seleccion', async (req, res) => {
  const { ID_PERIODO_ESCOLAR, ID_ALUMNO, NUMERO } = req.body;

  if (!ID_PERIODO_ESCOLAR || !ID_ALUMNO) {
    return res.status(400).json({ error: 'ID_PERIODO_ESCOLAR e ID_ALUMNO son obligatorios' });
  }

  try {
    const pool = await sql.connect();

    const query = `
      WITH Numeros AS (
        SELECT 0 AS Numero
        UNION ALL
        SELECT Numero + 1
        FROM Numeros
        WHERE Numero < 10
      )
      SELECT  
        CASE Numero
          WHEN 0 THEN 'Inscripción ' + CODIGO_PERIODO
          WHEN 1 THEN 'Enero ' + CODIGO_PERIODO
          WHEN 2 THEN 'Febrero ' + CODIGO_PERIODO
          WHEN 3 THEN 'Marzo ' + CODIGO_PERIODO
          WHEN 4 THEN 'Abril ' + CODIGO_PERIODO
          WHEN 5 THEN 'Mayo ' + CODIGO_PERIODO
          WHEN 6 THEN 'Junio ' + CODIGO_PERIODO
          WHEN 7 THEN 'Julio ' + CODIGO_PERIODO
          WHEN 8 THEN 'Agosto ' + CODIGO_PERIODO
          WHEN 9 THEN 'Septiembre ' + CODIGO_PERIODO
          WHEN 10 THEN 'Octubre ' + CODIGO_PERIODO
          ELSE NULL 
        END AS DESCRIPCION_DE_MES,

        CASE 
          WHEN Numero = 0 THEN P.PRECIO_DE_INSCRIPCION 
          ELSE 
            CASE 
              WHEN GETDATE() > CAST(CAST(YEAR(O.FECHA_INICIO_PERIODO) AS CHAR(4)) + '-' + FORMAT(Numero, '00') + '-05' AS DATE) 
              THEN P.PRECIO_DE_MENSUALIDAD + P.MORA_AUMENTO_INSOLVENCIA 
              ELSE P.PRECIO_DE_MENSUALIDAD 
            END 
        END AS MONTO,

        CASE Numero 
          WHEN 0 THEN 'I' 
          ELSE 'M' 
        END AS TIPO_PAGO, NUMERO

      FROM PRECIOS_POR_GRADO P 
      INNER JOIN ALUMNOS_POR_GRADO A 
        ON P.ID_PERIODO_ESCOLAR = A.ID_PERIODO_ESCOLAR 
       AND P.ID_GRADO = A.ID_GRADO 
      INNER JOIN PERIODOS_ESCOLARES O 
        ON O.ID_PERIODO_ESCOLAR = P.ID_PERIODO_ESCOLAR,
      Numeros
      WHERE P.ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR
        AND A.ID_ALUMNO = @ID_ALUMNO
        ${NUMERO !== undefined ? 'AND Numero = @NUMERO' : 
        'AND NOT EXISTS(SELECT * FROM PAGOS_COLEGIATURA X WHERE X.ID_PERIODO_ESCOLAR = P.ID_PERIODO_ESCOLAR AND X.ID_ALUMNO = A.ID_ALUMNO AND X.MES_DE_PAGO = NUMERO)   '}      
    `;

    const request = pool.request()
      .input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR)
      .input('ID_ALUMNO', sql.Int, ID_ALUMNO);

    if (NUMERO !== undefined) {
      request.input('NUMERO', sql.Int, NUMERO);
    }

    const result = await request.query(query);

    res.json(result.recordset);

  } catch (err) {
    console.error('Error en el endpoint /pagos:', err);
    res.status(500).json({ error: 'Error al obtener los datos de pago' });
  }
});

module.exports = router;