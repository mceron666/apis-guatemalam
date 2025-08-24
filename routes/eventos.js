const express = require('express');
const router = express.Router();
const sql = require('mssql');

router.post('/', async (req, res) => {
    const {
        NOMBRE_EVENTO,
        DESCRIPCION_EVENTO,
        FECHA_EVENTO,
        HORA_EVENTO,
        SE_SUSPENDEN_CLASES,
        APLICA_PARA,
        ACCION
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('NOMBRE_EVENTO', sql.VarChar(20), NOMBRE_EVENTO);
        request.input('DESCRIPCION_EVENTO', sql.VarChar(100), DESCRIPCION_EVENTO);
        request.input('FECHA_EVENTO', sql.Date, FECHA_EVENTO);
        request.input('HORA_EVENTO', sql.VarChar, HORA_EVENTO);
        request.input('SE_SUSPENDEN_CLASES', sql.Char(1), SE_SUSPENDEN_CLASES);
        request.input('APLICA_PARA', sql.Char(1), APLICA_PARA);
        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_EVENTOS');
        const mensaje = result.output.MENSAJE || '';

        res.status(200).json({ mensaje });
    } catch (err) {
        res.status(500).json({ 
            error: 'Error ejecutando el procedimiento', 
            details: err.message 
        });
    }
});

router.post('/lista', async (req, res) => {
    const { APLICA_PARA } = req.body;

    try {
        const pool = await sql.connect();
        let query = `
            SELECT 
                ID_EVENTO,
                NOMBRE_EVENTO,
                DESCRIPCION_EVENTO,
                CONVERT(varchar(10), FECHA_EVENTO, 120) AS FECHA_EVENTO,  
                CONVERT(varchar(8), HORA_EVENTO, 108) AS HORA_EVENTO,     
                SE_SUSPENDEN_CLASES,
                APLICA_PARA
            FROM EVENTOS_ESCOLARES
        `;

        // Si se envía APLICA_PARA, agregamos el filtro
        if (APLICA_PARA) {
            query += " WHERE APLICA_PARA IN(@APLICA_PARA, 'T') ";
        }

        const request = pool.request();
        if (APLICA_PARA) {
            request.input('APLICA_PARA', sql.Char(1), APLICA_PARA);
        }

        const result = await request.query(query);
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({
            error: 'Error al obtener los eventos',
            details: err.message
        });
    }
});


module.exports = router;
