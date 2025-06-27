const express = require('express');
const sql = require('mssql');

const router = express.Router();

// Obtener todas las materias o una específica por código
router.post('/filtrar', async (req, res) => {
    const {
        ID_GRADO,
        ID_MATERIA,
        ID_PERIODO_ESCOLAR,
        page = 1,
        limit = 10
    } = req.body;

    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        const request = pool.request();
        const countRequest = pool.request();

        let baseQuery = `FROM VL_MATERIAS_POR_GRADO WHERE 1=1`;

        if (ID_GRADO) {
            baseQuery += ` AND ID_GRADO = @ID_GRADO`;
            request.input('ID_GRADO', sql.Int, ID_GRADO);
            countRequest.input('ID_GRADO', sql.Int, ID_GRADO);
        }

        if (ID_MATERIA) {
            baseQuery += ` AND ID_MATERIA = @ID_MATERIA`;
            request.input('ID_MATERIA', sql.Int, ID_MATERIA);
            countRequest.input('ID_MATERIA', sql.Int, ID_MATERIA);
        }

        if (ID_PERIODO_ESCOLAR) {
            baseQuery += ` AND ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR`;
            request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
            countRequest.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        }

        const dataQuery = `
            SELECT * 
            ${baseQuery}
            ORDER BY FECHA_INGRESA_REGISTRO DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;

        const countQuery = `
            SELECT COUNT(*) AS total
            ${baseQuery}
        `;

        const result = await request.query(dataQuery);
        const countResult = await countRequest.query(countQuery);

        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: result.recordset,
            pagination: {
                total,
                totalPages,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener los registros', details: err.message });
    }
});
router.post('/maestros', async (req, res) => {
    const {
        ID_PERSONA,
        ID_PERIODO_ESCOLAR,
        ID_GRADO,
        ID_MATERIA
    } = req.body;

    if (!ID_PERSONA || !ID_PERIODO_ESCOLAR) {
        return res.status(400).json({ error: 'ID_PERSONA e ID_PERIODO_ESCOLAR son obligatorios' });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input('ID_PERSONA', sql.Int, ID_PERSONA);
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);

        let whereClause = `WHERE ID_PERSONA = @ID_PERSONA AND ID_PERIODO_ESCOLAR = @ID_PERIODO_ESCOLAR`;

        if (ID_GRADO) {
            whereClause += ` AND ID_GRADO = @ID_GRADO`;
            request.input('ID_GRADO', sql.Int, ID_GRADO);
        }

        if (ID_MATERIA) {
            whereClause += ` AND ID_MATERIA = @ID_MATERIA`;
            request.input('ID_MATERIA', sql.Int, ID_MATERIA);
        }

        const query = `
            SELECT 
                ID_GRADO,
                NOMBRE_GRADO,
                NIVEL_GRADO,
                NOMBRE_MATERIA,
                COLOR_MATERIA,
                USA_LETRAS_BLANCAS,
                ID_MATERIA_GRADO, 
                ID_MATERIA
            FROM VL_MATERIAS_POR_PROFESOR
            ${whereClause}
            ORDER BY NIVEL_GRADO ASC, NOMBRE_MATERIA ASC
        `;

        const result = await request.query(query);

        // Agrupar por grado
        const gradosMap = new Map();

        result.recordset.forEach(row => {
            const gradoKey = row.ID_GRADO;
            if (!gradosMap.has(gradoKey)) {
                gradosMap.set(gradoKey, {
                    nombreGrado: row.NOMBRE_GRADO,
                    nivelGrado: row.NIVEL_GRADO,
                    idGrado : row.ID_GRADO,
                    materias: []
                });
            }

            gradosMap.get(gradoKey).materias.push({
                nombreMateria: row.NOMBRE_MATERIA,
                color: row.COLOR_MATERIA,
                usaLetrasBlancas: row.USA_LETRAS_BLANCAS,
                idMateriaGrado: row.ID_MATERIA_GRADO, 
                idMateria : row.ID_MATERIA
            });
        });

        const response = Array.from(gradosMap.values())
            .sort((a, b) => a.nivelGrado - b.nivelGrado)
            .map(g => ({
                idGrado: g.idGrado, // Agregado aquí
                nombreGrado: g.nombreGrado,
                materias: g.materias
            }));

        res.json(response);


    } catch (err) {
        res.status(500).json({ error: 'Error al obtener los registros', details: err.message });
    }
});


router.post('/', async (req, res) => {
    const {
        ID_PERIODO_ESCOLAR,
        ID_GRADO,
        ID_MATERIA,
        ID_MAESTRO,
        ID_PERSONA_INGRESO,
        ACCION
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('ID_GRADO', sql.Int, ID_GRADO);
        request.input('ID_MATERIA', sql.Int, ID_MATERIA);
        request.input('ID_MAESTRO', sql.Int, ID_MAESTRO);
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_MATERIAS_POR_GRADO');
        const mensaje = result.output.MENSAJE || '';

        res.status(200).json({ mensaje });
    } catch (err) {
        res.status(500).json({ error: 'Error ejecutando el procedimiento', details: err.message });
    }
});


module.exports = router;