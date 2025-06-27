const express = require('express');
const sql = require('mssql');

const router = express.Router();

// Obtener todas las materias o una específica por código
router.post('/filtrar', async (req, res) => {
    const {
        ID_GRADO,
        ID_MATERIA,
        ID_PERIODO_ESCOLAR
    } = req.body;

    try {
        const pool = await sql.connect();
        const request = pool.request();

        let whereClause = `WHERE DIA_DE_LA_SEMANA BETWEEN 1 AND 5`;

        if (ID_GRADO) {
            whereClause += ` AND ID_GRADO = @ID_GRADO`;
            request.input('ID_GRADO', sql.Int, ID_GRADO);
        }
        if (ID_MATERIA) {
            whereClause += ` AND ID_MATERIA = @ID_MATERIA`;
            request.input('ID_MATERIA', sql.Int, ID_MATERIA);
        }
        if (ID_PERIODO_ESCOLAR) {
            whereClause += ` AND ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR`;
            request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        }

        const horariosQuery = `
            SELECT 
                CODIGO_HORARIO,
                CAST(HORA_INICIO AS CHAR(8)) + ' - ' + CAST(HORA_FINAL AS CHAR(8)) AS DESCRIPCION_HORA
            FROM HORARIOS_ESCOLARES
            ORDER BY CODIGO_HORARIO
        `;
        const horariosResult = await pool.request().query(horariosQuery);
        const horarios = horariosResult.recordset;

        const query = `
            SELECT 
                ID_GRADO, 
                ID_MATERIA, 
                ID_PERIODO_ESCOLAR, 
                DIA_DE_LA_SEMANA, 
                CODIGO_HORARIO,
                USA_LETRAS_BLANCAS, 
                COLOR_MATERIA, 
                NOMBRE_MATERIA, 
                ES_RECREO
            FROM VL_CALENDARIO_POR_GRASO
            ${whereClause}
            ORDER BY DIA_DE_LA_SEMANA ASC, CODIGO_HORARIO ASC
        `;
        const result = await request.query(query);
        const rows = result.recordset;

        const diasSemana = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        for (const row of rows) {
            diasSemana[row.DIA_DE_LA_SEMANA].push(row);
        }

        res.json({ horarios, calendario: diasSemana });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener el calendario', details: err.message });
    }
});

router.post('/filtrar/:dia/:codigo', async (req, res) => {
    const {
        ID_GRADO,
        ID_PERIODO_ESCOLAR
    } = req.body;

    const { dia, codigo } = req.params;

    if (!ID_GRADO || !ID_PERIODO_ESCOLAR) {
        return res.status(400).json({ error: 'ID_GRADO y ID_PERIODO_ESCOLAR son obligatorios' });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input('ID_GRADO', sql.Int, ID_GRADO);
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('DIA', sql.Int, parseInt(dia));
        request.input('CODIGO', sql.Int, parseInt(codigo));

        const horariosQuery = `
            SELECT 
                CODIGO_HORARIO,
                CAST(HORA_INICIO AS CHAR(8)) + ' - ' + CAST(HORA_FINAL AS CHAR(8)) AS DESCRIPCION_HORA
            FROM HORARIOS_ESCOLARES
            ORDER BY CODIGO_HORARIO
        `;
        const horariosResult = await pool.request().query(horariosQuery);
        const horarios = horariosResult.recordset;

        const query = `
            SELECT 
                ID_GRADO, 
                ID_MATERIA, 
                ID_PERIODO_ESCOLAR, 
                DIA_DE_LA_SEMANA, 
                CODIGO_HORARIO,
                USA_LETRAS_BLANCAS, 
                COLOR_MATERIA, 
                NOMBRE_MATERIA, 
                ES_RECREO, 
                DESCRIPCION_HORA
            FROM VL_CALENDARIO_POR_GRASO
            WHERE DIA_DE_LA_SEMANA = @DIA 
              AND CODIGO_HORARIO = @CODIGO
              AND ID_GRADO = @ID_GRADO
              AND ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR
        `;
        const result = await request.query(query);
        const unico = result.recordset.length > 0 ? result.recordset[0] : null;

        res.json({
            horarioSeleccionado: unico
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al obtener el bloque específico', details: err.message });
    }
});


router.post('/', async (req, res) => {
    const {
        ID_PERIODO_ESCOLAR,
        ID_GRADO,
        ID_MATERIA,
        DIA_DE_LA_SEMANA,
        CODIGO_HORARIO,
        ES_RECREO, // 'Y' o 'N'
        ACCION,    // 'I', 'U', 'D'
        ID_PERSONA_INGRESO
    } = req.body;

    try {
        const request = new sql.Request();

        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('ID_GRADO', sql.Int, ID_GRADO);

        // Si es recreo, ID_MATERIA debe ser null
        if (ES_RECREO === 'Y') {
            request.input('ID_MATERIA', sql.Int, null);
        } else {
            request.input('ID_MATERIA', sql.Int, ID_MATERIA);
        }

        request.input('DIA_DE_LA_SEMANA', sql.Int, DIA_DE_LA_SEMANA);
        request.input('CODIGO_HORARIO', sql.Int, CODIGO_HORARIO);
        request.input('ES_RECREO', sql.Char(1), ES_RECREO);
        request.input('ACCION', sql.Char(1), ACCION);
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_CALENDARIO');
        const mensaje = result.output.MENSAJE || '';

        res.status(200).json({ mensaje });
    } catch (err) {
        res.status(500).json({
            error: 'Error ejecutando el procedimiento',
            details: err.message
        });
    }
});




module.exports = router;