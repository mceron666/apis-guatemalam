const express = require('express');
const router = express.Router();
const sql = require('mssql');
router.post('/lista', async (req, res) => {
    const { ID_PERIODO_ESCOLAR } = req.body;

    if (!ID_PERIODO_ESCOLAR) {
        return res.status(400).json({ error: 'El ID_PERIODO_ESCOLAR es requerido.' });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);

        const query = `
            SELECT 
                G.ID_GRADO, 
                G.CODIGO_GRADO, 
                G.NOMBRE_GRADO, 
                G.SECCION_GRADO, 
                G.NIVEL_GRADO, 
                COALESCE(P.PRECIO_DE_MENSUALIDAD, 0) AS PRECIO_DE_MENSUALIDAD,
                COALESCE(P.PRECIO_DE_INSCRIPCION, 0) AS PRECIO_DE_INSCRIPCION,
                COALESCE(P.MORA_AUMENTO_INSOLVENCIA, 0) AS MORA_AUMENTO_INSOLVENCIA
            FROM GRADOS_ESCOLARES G
            LEFT JOIN (
                SELECT 
                    ID_GRADO, 
                    PRECIO_DE_MENSUALIDAD, 
                    PRECIO_DE_INSCRIPCION, 
                    MORA_AUMENTO_INSOLVENCIA
                FROM PRECIOS_POR_GRADO 
                WHERE ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR
            ) P ON P.ID_GRADO = G.ID_GRADO
            ORDER BY G.NIVEL_GRADO, G.NOMBRE_GRADO, G.SECCION_GRADO;
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
    const { ID_PERIODO_ESCOLAR, precios } = req.body;

    try {
        // Crear tabla de tipo PRECIOS_GRADO_JSON
        const table = new sql.Table(); // No se especifica nombre, solo se estructura
        table.columns.add('NUMERO_FILA', sql.Int);
        table.columns.add('ID_GRADO', sql.Int);
        table.columns.add('PRECIO_MENSUALIDAD', sql.Decimal(15, 2));
        table.columns.add('PRECIO_INSCRIPCION', sql.Decimal(15, 2));
        table.columns.add('MORA_AUMENTO_INSOLVENCIA', sql.Decimal(15, 2));

        // Rellenar la tabla
        precios.forEach((item, index) => {
            table.rows.add(index + 1, item.ID_GRADO, item.PRECIO_MENSUALIDAD, item.PRECIO_INSCRIPCION, item.MORA_AUMENTO_INSOLVENCIA);
        });

        const request = new sql.Request();
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('PRECIOS', table); // Tabla tipo PRECIOS_GRADO_JSON
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_GUARDAR_PRECIOS_POR_GRADO');
        const mensaje = result.output.MENSAJE || '';

        res.status(200).json({ mensaje });
    } catch (err) {
        res.status(500).json({ error: 'Error ejecutando el procedimiento', details: err.message });
    }
});

module.exports = router;
