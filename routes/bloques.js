const express = require('express');
const sql = require('mssql');

const router = express.Router();

router.post("/", async (req, res) => {
    const { ID_PERIODO_ESCOLAR } = req.body;

    if (!ID_PERIODO_ESCOLAR) {
        return res.status(400).json({ error: "ID_PERIODO_ESCOLAR es obligatorio." });
    }
  
    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input("ID_PERIODO_ESCOLAR", sql.Int, ID_PERIODO_ESCOLAR);

        const query = `
            SELECT 
                ID_BLOQUE_ESCOLAR, 
                NUMERO_BLOQUE, 
                NOMBRE_BLOQUE, 
                FECHA_INICIO_BLOQUE, 
                FECHA_FINALIZA_BLOQUE 
            FROM BLOQUES_ESCOLARES
            WHERE 
                ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR
                AND FECHA_INICIO_BLOQUE <= GETDATE()
            ORDER BY FECHA_INICIO_BLOQUE DESC
        `;
  
        const result = await request.query(query);
        res.json({ bloques: result.recordset });

    } catch (err) {
        res.status(500).json({ error: "Error al consultar los bloques.", details: err.message });
    }
});

    
module.exports = router;