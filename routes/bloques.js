const express = require('express');
const sql = require('mssql');

const router = express.Router();

router.post('/', async (req, res) => {
    const { ID_PERIODO_ESCOLAR, FECHA } = req.body;

    if (!ID_PERIODO_ESCOLAR) {
        return res.status(400).json({ error: 'ID_PERIODO_ESCOLAR es obligatorio.' });
    }

    // Usar fecha actual si no se proporciona
    const fechaConsulta = FECHA ? new Date(FECHA) : new Date();
    const fechaFormateada = fechaConsulta.toISOString().split('T')[0];

    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('FECHA', sql.Date, fechaFormateada);

        const query = `
            SELECT TOP 1 
                ID_BLOQUE_ESCOLAR, 
                NUMERO_BLOQUE, 
                NOMBRE_BLOQUE, 
                FECHA_INICIO_BLOQUE, 
                FECHA_FINALIZA_BLOQUE 
            FROM BLOQUES_ESCOLARES
            WHERE  
                FECHA_INICIO_BLOQUE <= @FECHA
                AND FECHA_FINALIZA_BLOQUE >= @FECHA
                AND ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR

            UNION ALL

            SELECT 
                ID_BLOQUE_ESCOLAR, 
                NUMERO_BLOQUE, 
                NOMBRE_BLOQUE, 
                FECHA_INICIO_BLOQUE, 
                FECHA_FINALIZA_BLOQUE 
            FROM BLOQUES_ESCOLARES
            WHERE 
                ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR
                AND FECHA_INICIO_BLOQUE <= @FECHA
        `;

        const result = await request.query(query);
        const records = result.recordset;

        if (records.length === 0) {
            return res.json({ bloqueActual: null, listaBloques: [] });
        }

        const bloqueActual = records[0];
        const listaBloques = records.slice(1);

        res.json({
            bloqueActual,
            listaBloques
        });

    } catch (err) {
        res.status(500).json({ error: 'Error al consultar los bloques escolares.', details: err.message });
    }
});
    
module.exports = router;