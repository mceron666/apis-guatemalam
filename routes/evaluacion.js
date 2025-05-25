const express = require('express');
const sql = require('mssql');

const router = express.Router();

router.post('/lista', async (req, res) => {
    const { ID_PERIODO_ESCOLAR, ID_MATERIA, ID_GRADO, ID_BLOQUE_ESCOLAR } = req.body;

    if (!ID_PERIODO_ESCOLAR || !ID_MATERIA || !ID_GRADO || !ID_BLOQUE_ESCOLAR) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('ID_MATERIA', sql.Int, ID_MATERIA);
        request.input('ID_GRADO', sql.Int, ID_GRADO);
        request.input('ID_BLOQUE_ESCOLAR', sql.Int, ID_BLOQUE_ESCOLAR);

        const query = `
            SELECT *
            FROM VL_EVALUACION_MATERIA_DETALLE
            WHERE 
                ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR AND
                ID_MATERIA = @ID_MATERIA AND
                ID_GRADO = @ID_GRADO AND
                ID_BLOQUE_ESCOLAR = @ID_BLOQUE_ESCOLAR
            ORDER BY ORDEN_EVALUACION;
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
        ORDEN_EVALUACION,
        DESCRIPCION_EVALUACION,
        PUNTEO_ESTIPULADO,
        ID_PERSONA_INGRESO,
        ID_MATERIA,
        ID_GRADO,
        ID_PERIODO_ESCOLAR,
        ID_BLOQUE_ESCOLAR,
        ACCION
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('ORDEN_EVALUACION', sql.SmallInt, ORDEN_EVALUACION);
        request.input('DESCRIPCION_EVALUACION', sql.VarChar(50), DESCRIPCION_EVALUACION);
        request.input('PUNTEO_ESTIPULADO', sql.SmallInt, PUNTEO_ESTIPULADO);
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.input('ID_MATERIA', sql.Int, ID_MATERIA);
        request.input('ID_GRADO', sql.Int, ID_GRADO);
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('ID_BLOQUE_ESCOLAR', sql.Int, ID_BLOQUE_ESCOLAR);
        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_DETALLE_EVALUACION');
        const mensaje = result.output.MENSAJE || '';

        res.status(200).json({ mensaje });

    } catch (err) {
        res.status(500).json({ error: 'Error ejecutando el procedimiento', details: err.message });
    }
});

module.exports = router;