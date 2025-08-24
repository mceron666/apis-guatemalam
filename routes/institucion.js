const express = require("express")
const sql = require("mssql")
const puppeteer = require("puppeteer")

const router = express.Router() 
router.get('/', async (req, res) => {
    try {
        const request = new sql.Request();

        const result = await request.query(`
            SELECT 
                NOMBRE_COLEGIO,
                DIRECCION,
                DEPARTAMENTO,
                MUNICIPIO,
                ZONA,
                TELEFONO,
                EMAIL,
                IDENTIFICADOR_DIRECTOR,
                IDENTIFICADOR_SUBDIRECTOR,
                NIT,
                CODIGO_MINEDUC, 
				V.NOMBRE_COMPLETO AS NOMBRE_DIRECTOR,
				V2.NOMBRE_COMPLETO AS NOMBRE_SUBDIRECTOR
            FROM INFORMACION_INSTITUCIONAL L
				LEFT JOIN VL_PERSONAL_ESCOLAR V
					ON L.IDENTIFICADOR_DIRECTOR = V.ID_PERSONA
				LEFT JOIN VL_PERSONAL_ESCOLAR V2
					ON L.IDENTIFICADOR_SUBDIRECTOR = V2.ID_PERSONA
        `);

        // Como la tabla se espera que tenga solo un registro, tomamos el primero
        const datos = result.recordset[0];
        res.status(200).json(datos);

    } catch (error) {
        res.status(500).json({
            error: 'Error al obtener los datos del colegio.',
            detalle: error.message
        });
    }
});
router.post('/', async (req, res) => {
    const {
        NOMBRE_COLEGIO,
        DIRECCION,
        DEPARTAMENTO,
        MUNICIPIO,
        ZONA,
        TELEFONO,
        EMAIL,
        IDENTIFICADOR_DIRECTOR,
        IDENTIFICADOR_SUBDIRECTOR,
        NIT,
        CODIGO_MINEDUC
    } = req.body;

    try {
        const request = new sql.Request();

        request.input('NOMBRE_COLEGIO', sql.VarChar(150), NOMBRE_COLEGIO);
        request.input('DIRECCION', sql.VarChar(50), DIRECCION);
        request.input('DEPARTAMENTO', sql.VarChar(50), DEPARTAMENTO || null);
        request.input('MUNICIPIO', sql.VarChar(50), MUNICIPIO || null);
        request.input('ZONA', sql.VarChar(10), ZONA || null);
        request.input('TELEFONO', sql.VarChar(20), TELEFONO || null);
        request.input('EMAIL', sql.VarChar(100), EMAIL || null);
        request.input('IDENTIFICADOR_DIRECTOR', sql.Int, IDENTIFICADOR_DIRECTOR || null);
        request.input('IDENTIFICADOR_SUBDIRECTOR', sql.Int, IDENTIFICADOR_SUBDIRECTOR || null);
        request.input('NIT', sql.VarChar(20), NIT || null);
        request.input('CODIGO_MINEDUC', sql.VarChar(20), CODIGO_MINEDUC || null);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('GUARDAR_DATOS_COLEGIO');

        const mensaje = result.output.MENSAJE || '';

        res.status(200).json({ mensaje });

    } catch (error) {
        res.status(500).json({
            error: 'Error ejecutando el procedimiento.',
            detalle: error.message
        });
    }
});

router.get('/estadisticas', async (req, res) => {
    try {
        const request = new sql.Request();

        // 1. Personal por rol
        const personalPorRol = await request.query(`
            SELECT 
                ROL_PERSONA, 
                COUNT(*) AS TOTAL
            FROM VL_PERSONAL_ESCOLAR 
            GROUP BY ROL_PERSONA
        `);

        // 2. Resumen de solvencia
        const solvenciaAlumnos = await request.query(`
            SELECT 
                SUM(dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL)) AS CANTIDAD, 
                SUM(CASE WHEN dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) < 0 
                    THEN dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) ELSE 0 END) AS DEUDA, 
                SUM(CASE WHEN dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) > 0 
                    THEN dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) ELSE 0 END) AS PAGADO, 
                SUM(CASE WHEN dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) < 0 THEN 1 ELSE 0 END) AS ALUMNOS_CON_DEUDA, 
                SUM(CASE WHEN dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) > 0 THEN 1 ELSE 0 END) AS ALUMNOS_SOLVENTES
            FROM VL_PERSONAL_ESCOLAR 
            INNER JOIN GRADOS_ESCOLARES G 
                ON G.ID_GRADO = dbo.GRADO_ACTUAL(ID_ALUMNO)
            WHERE ID_ALUMNO IS NOT NULL
              AND dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) IS NOT NULL
        `);

        // 3. Eventos próximos
        const eventosProximos = await request.query(`
            SELECT 
                NOMBRE_EVENTO, 
                DESCRIPCION_EVENTO, 
                FECHA_EVENTO, 
                HORA_EVENTO, 
                SE_SUSPENDEN_CLASES, 
                APLICA_PARA
            FROM EVENTOS_ESCOLARES
            WHERE FECHA_EVENTO > GETDATE() AND FECHA_EVENTO <  DATEADD(MONTH, 1, GETDATE())
        `);

        // Respuesta unificada
        const datos = {
            personal: personalPorRol.recordset,
            solvencia: solvenciaAlumnos.recordset[0],
            eventos: eventosProximos.recordset
        };

        res.status(200).json(datos);

    } catch (error) {
        res.status(500).json({
            error: 'Error al obtener estadísticas.',
            detalle: error.message
        });
    }
});



module.exports = router