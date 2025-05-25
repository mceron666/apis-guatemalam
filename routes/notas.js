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
module.exports = router;