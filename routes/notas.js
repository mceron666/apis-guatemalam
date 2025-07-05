const express = require('express');
const sql = require('mssql');

const router = express.Router();

router.post('/evaluacion', async (req, res) => {
    const { ID_PERIODO_ESCOLAR, ID_MATERIA, ID_GRADO, ID_BLOQUE_ESCOLAR, ORDEN_EVALUACION } = req.body;

    if (
        !ID_PERIODO_ESCOLAR ||
        !ID_MATERIA ||
        !ID_GRADO ||
        !ID_BLOQUE_ESCOLAR ||
        !ORDEN_EVALUACION
    ) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        // Parámetros
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('ID_MATERIA', sql.Int, ID_MATERIA);
        request.input('ID_GRADO', sql.Int, ID_GRADO);
        request.input('ID_BLOQUE_ESCOLAR', sql.Int, ID_BLOQUE_ESCOLAR);
        request.input('ORDEN_EVALUACION', sql.Int, ORDEN_EVALUACION);

        const query = `
            SELECT 
                ROW_NUMBER() OVER (ORDER BY A.NOMBRE_ALUMNO) AS NUMERO_FILA,
                A.ID_ALUMNO_GRADO,
                A.PERFIL_PERSONA,
                A.NOMBRE_ALUMNO,
                COALESCE(T.PUNTEO_ALUMNO, 0) AS PUNTEO_ALUMNO
            FROM VL_ALUMNOS_POR_GRADO A
            LEFT JOIN (
                SELECT  
                    G.ID_ALUMNO_GRADO, 
                    N.PUNTEO_ALUMNO
                FROM NOTAS_EVALUACION_POR_ALUMNO N
                INNER JOIN EVALUACION_MATERIA_DETALLE D 
                    ON N.ID_DETALLE_EVALUACION = D.ID_DETALLE_EVALUACION
                INNER JOIN MATERIAS_POR_GRADO M 
                    ON D.ID_MATERIA_GRADO = M.ID_MATERIA_GRADO
                INNER JOIN ALUMNOS_POR_GRADO G 
                    ON N.ID_ALUMNO_GRADO = G.ID_ALUMNO_GRADO
                WHERE 
                    M.ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR AND 
                    M.ID_GRADO = @ID_GRADO AND 
                    ID_MATERIA = @ID_MATERIA AND 
                    ID_BLOQUE_ESCOLAR = @ID_BLOQUE_ESCOLAR AND
                    ORDEN_EVALUACION = @ORDEN_EVALUACION
            ) T ON A.ID_ALUMNO_GRADO = T.ID_ALUMNO_GRADO
            WHERE 
                A.ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR AND 
                A.ID_GRADO = @ID_GRADO
            ORDER BY A.NOMBRE_ALUMNO;
        `;

        const result = await request.query(query);

        res.json({
            data: result.recordset,
            total: result.recordset.length
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al ejecutar la consulta', details: err.message });
    }
});
router.post('/', async (req, res) => {
    const {
        ID_PERIODO_ESCOLAR,
        ID_MATERIA,
        ID_GRADO,
        ID_BLOQUE_ESCOLAR,
        ORDEN_EVALUACION,
        notas
    } = req.body;
    
    try {
        const table = new sql.Table(); // No pasamos nombre aquí porque lo usamos solo como estructura
        table.columns.add('NUMERO_FILA', sql.Int);
        table.columns.add('ID_ALUMNO', sql.Int);
        table.columns.add('PUNTEO_ALUMNO', sql.Decimal(5, 2));
    
        notas.forEach(nota => {
            table.rows.add(nota.NUMERO_FILA, nota.ID_ALUMNO, nota.PUNTEO_ALUMNO);
        });
    
        const request = new sql.Request();
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('ID_MATERIA', sql.Int, ID_MATERIA);
        request.input('ID_GRADO', sql.Int, ID_GRADO);
        request.input('ID_BLOQUE_ESCOLAR', sql.Int, ID_BLOQUE_ESCOLAR);
        request.input('ORDEN_EVALUACION', sql.Int, ORDEN_EVALUACION);
        request.input('NOTAS', table);  // tipo tabla
        request.output('MENSAJE', sql.NVarChar(255));
    
        const result = await request.execute('PROCEDIMIENTO_GUARDAR_NOTAS');
        const mensaje = result.output.MENSAJE || '';
    
        res.status(200).json({ mensaje });
    } catch (err) {
        res.status(500).json({ error: 'Error ejecutando el procedimiento', details: err.message });
    }
    
});
// Endpoint: GET /notas-bloques/:idAlumno/:idPeriodo
router.get('/:idAlumno/:idPeriodo', async (req, res) => {
    const { idAlumno, idPeriodo } = req.params;
    const sql = require('mssql');

    try {
        const request = new sql.Request();
        request.input('ID_ALUMNO', sql.Int, idAlumno);
        request.input('ID_PERIODO', sql.Int, idPeriodo);

        // 1. Obtener las materias asignadas al alumno
        const materiasResult = await request.query(`
            SELECT 
                ROW_NUMBER() OVER (ORDER BY CODIGO_MATERIA) AS NUMERO, 
                X.ID_MATERIA,
                NOMBRE_MATERIA, 
                COLOR_MATERIA, 
                USA_LETRAS_BLANCAS
            FROM MATERIAS_ESCOLARES X 
            WHERE EXISTS (
                SELECT * 
                FROM MATERIAS_POR_GRADO H 
                WHERE H.ID_MATERIA = X.ID_MATERIA 
                  AND H.ID_PERIODO_ESCOLAR = @ID_PERIODO 
                  AND H.ID_GRADO = (
                        SELECT ID_GRADO 
                        FROM ALUMNOS_POR_GRADO 
                        WHERE ID_PERIODO_ESCOLAR = @ID_PERIODO AND ID_ALUMNO = @ID_ALUMNO
                  )
            )
        `);
        const materias = materiasResult.recordset;

        // 2. Obtener los bloques escolares del período
        const bloquesResult = await request.query(`
            SELECT 
                B.ID_BLOQUE_ESCOLAR, 
                B.NOMBRE_BLOQUE, 
                dbo.DIFERENCIA_DE_SOLVENCIA(@ID_ALUMNO, B.FECHA_FINALIZA_BLOQUE) AS SOLVENCIA, 
                B.FECHA_FINALIZA_BLOQUE
            FROM BLOQUES_ESCOLARES B 
            INNER JOIN ALUMNOS_POR_GRADO G 
                ON B.ID_PERIODO_ESCOLAR = G.ID_PERIODO_ESCOLAR 
            WHERE G.ID_ALUMNO = @ID_ALUMNO AND G.ID_PERIODO_ESCOLAR = @ID_PERIODO
        `);
        const bloques = bloquesResult.recordset;

        // 3. Armar estructura final con notas por bloque si solvente
        const bloquesConNotas = [];

        for (const bloque of bloques) {
            const { ID_BLOQUE_ESCOLAR, NOMBRE_BLOQUE, SOLVENCIA, FECHA_FINALIZA_BLOQUE } = bloque;

            let notas = [];

            if (SOLVENCIA >= 0) {
                const notasRequest = new sql.Request();
                notasRequest.input('ID_ALUMNO', sql.Int, idAlumno);
                notasRequest.input('ID_PERIODO', sql.Int, idPeriodo);
                notasRequest.input('ID_BLOQUE', sql.Int, ID_BLOQUE_ESCOLAR);

                const notasResult = await notasRequest.query(`
                    SELECT 
                        ROW_NUMBER() OVER (ORDER BY X.CODIGO_MATERIA) AS NUMERO,
                        COALESCE(T.TOTAL, 0) AS TOTAL
                    FROM MATERIAS_ESCOLARES X
                    LEFT JOIN (
                       select G.ID_MATERIA, SUM(PUNTEO_ALUMNO) AS TOTAL from NOTAS_EVALUACION_POR_ALUMNO A
INNER JOIN EVALUACION_MATERIA_DETALLE D ON A.ID_DETALLE_EVALUACION = D.ID_DETALLE_EVALUACION 
INNER JOIN MATERIAS_POR_GRADO G ON D.ID_MATERIA_GRADO = G.ID_MATERIA_GRADO
INNER JOIN ALUMNOS_POR_GRADO P ON A.ID_ALUMNO_GRADO = P.ID_ALUMNO_GRADO
WHERE G.ID_PERIODO_ESCOLAR = @ID_PERIODO AND P.ID_ALUMNO = @ID_ALUMNO AND ID_BLOQUE_ESCOLAR = @ID_BLOQUE
GROUP BY G.ID_MATERIA
                    ) AS T ON X.ID_MATERIA = T.ID_MATERIA
                    WHERE EXISTS (
                        SELECT * 
                        FROM MATERIAS_POR_GRADO H 
                        WHERE H.ID_MATERIA = X.ID_MATERIA 
                          AND ID_PERIODO_ESCOLAR = @ID_PERIODO
                          AND H.ID_GRADO = (
                                SELECT ID_GRADO 
                                FROM ALUMNOS_POR_GRADO 
                                WHERE ID_PERIODO_ESCOLAR = @ID_PERIODO AND ID_ALUMNO = @ID_ALUMNO
                          )
                    )
                `);
                notas = notasResult.recordset;
            }

            bloquesConNotas.push({
                idBloque: ID_BLOQUE_ESCOLAR,
                nombreBloque: NOMBRE_BLOQUE,
                fechaFinaliza: FECHA_FINALIZA_BLOQUE,
                solvente: SOLVENCIA >= 0,
                notas: notas
            });
        }

        res.json({
            alumno: parseInt(idAlumno),
            periodo: parseInt(idPeriodo),
            materias,
            bloques: bloquesConNotas
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener datos de notas por bloque.' });
    }
});

module.exports = router;