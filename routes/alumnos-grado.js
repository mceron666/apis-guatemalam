const express = require('express');
const sql = require('mssql');

const router = express.Router();
router.post('/filtrar', async (req, res) => {
    const {
        ID_GRADO,
        ID_ALUMNO,
        ID_PERIODO_ESCOLAR,
        page = 1,
        limit = 10
    } = req.body;

    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        const request = pool.request();
        const countRequest = pool.request();

        let baseQuery = `FROM VL_ALUMNOS_POR_GRADO WHERE 1=1`;

        if (ID_GRADO) {
            baseQuery += ` AND ID_GRADO = @ID_GRADO`;
            request.input('ID_GRADO', sql.Int, ID_GRADO);
            countRequest.input('ID_GRADO', sql.Int, ID_GRADO);
        }

        if (ID_ALUMNO) {
            baseQuery += ` AND ID_ALUMNO = @ID_ALUMNO`;
            request.input('ID_ALUMNO', sql.Int, ID_ALUMNO);
            countRequest.input('ID_ALUMNO', sql.Int, ID_ALUMNO);
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

router.post('/lista', async (req, res) => {
    const {
        ID_GRADO,
        NOMBRE_COMPLETO,
        CORREO_PERSONA,
        SOLVENCIA,
        page = 1,
        limit = 10
    } = req.body;

    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();

        const request = pool.request();
        const countRequest = pool.request();

        let baseQuery = `
            FROM VL_PERSONAL_ESCOLAR 
            INNER JOIN GRADOS_ESCOLARES G 
                ON G.ID_GRADO = dbo.GRADO_ACTUAL(ID_ALUMNO)
            WHERE ID_ALUMNO IS NOT NULL
              AND dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) IS NOT NULL
        `;

        // Condiciones dinámicas
        if (ID_GRADO) {
            baseQuery += ` AND G.ID_GRADO = @ID_GRADO`;
            request.input('ID_GRADO', sql.Int, ID_GRADO);
            countRequest.input('ID_GRADO', sql.Int, ID_GRADO);
        }

        if (NOMBRE_COMPLETO) {
            baseQuery += ` AND NOMBRE_COMPLETO LIKE @NOMBRE_COMPLETO`;
            request.input('NOMBRE_COMPLETO', sql.NVarChar, `%${NOMBRE_COMPLETO}%`);
            countRequest.input('NOMBRE_COMPLETO', sql.NVarChar, `%${NOMBRE_COMPLETO}%`);
        }

        if (CORREO_PERSONA) {
            baseQuery += ` AND CORREO_PERSONA LIKE @CORREO_PERSONA`;
            request.input('CORREO_PERSONA', sql.NVarChar, `%${CORREO_PERSONA}%`);
            countRequest.input('CORREO_PERSONA', sql.NVarChar, `%${CORREO_PERSONA}%`);
        }

        if (SOLVENCIA === 'Y') {
            baseQuery += ` AND dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) >= 0`;
        } else if (SOLVENCIA === 'N') {
            baseQuery += ` AND dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) < 0`;
        }

        // Consulta principal con paginación
        const dataQuery = `
            SELECT 
                ID_ALUMNO,
                ID_PERSONA,
                PERFIL_PERSONA,
                NOMBRE_COMPLETO,
                CORREO_PERSONA,
                SECCION_GRADO,
                dbo.DIFERENCIA_DE_SOLVENCIA(ID_ALUMNO, NULL) AS DIFERENCIA_SOLVENCIA,
                NOMBRE_GRADO
            ${baseQuery}
            ORDER BY NIVEL_GRADO, G.CODIGO_GRADO
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;

        // Consulta de conteo total
        const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;

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
        res.status(500).json({
            error: 'Error al obtener la lista de alumnos con filtros',
            details: err.message
        });
    }
});



// Insertar, actualizar o eliminar alumno en grado
router.post('/', async (req, res) => {
    const {
        ID_PERIODO_ESCOLAR,
        ID_GRADO,
        ID_ALUMNO,
        ID_PERSONA_INGRESO,
        ACCION
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('ID_GRADO', sql.Int, ID_GRADO);
        request.input('ID_ALUMNO', sql.Int, ID_ALUMNO);
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_ALUMNOS_POR_GRADO');
        const mensaje = result.output.MENSAJE || '';

        res.status(200).json({ mensaje });
    } catch (err) {
        res.status(500).json({ error: 'Error ejecutando el procedimiento', details: err.message });
    }
});
router.post('/seleccion/:nombre?', async (req, res) => {
    const { ID_PERIODO_ESCOLAR, ID_CARRERA = null, NIVEL } = req.body;
    const nombreParam = req.params.nombre || ''; // Si no viene nombre, se usa vacío

    if (!ID_PERIODO_ESCOLAR || !NIVEL) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('NIVEL', sql.Int, NIVEL);
        request.input('NOMBRE', sql.VarChar, `%${nombreParam}%`);

        let carrera = '';
        if (ID_CARRERA === null) {
            carrera = `IDENTIFICADOR_CARRERA_ESTUDIANTIL IS NULL`;
        } else {
            request.input('ID_CARRERA', sql.Int, ID_CARRERA);
            carrera = `IDENTIFICADOR_CARRERA_ESTUDIANTIL = @ID_CARRERA`;
        }

        const query = `
            SELECT ID_ALUMNO, PERFIL_PERSONA, NOMBRE_COMPLETO, NOMBRE_GRADO, ESTADO_RESULTADO
            FROM (
                SELECT ID_ALUMNO, PERFIL_PERSONA, NOMBRE_COMPLETO, NOMBRE_GRADO, ESTADO_RESULTADO
                FROM VISTA_RESULTADOS_POR_ALUMNO
                WHERE NIVEL_GRADO = @NIVEL - 1 AND ${carrera}
                AND ESTADO_ALUMNO = 'A' AND ESTADO_RESULTADO = 'G'
                AND ID_PERIODO_ESCOLAR = dbo.FUNCION_PERIODO_ANTERIOR(@ID_PERIODO_ESCOLAR)
                AND NOT EXISTS (
                    SELECT * FROM ALUMNOS_POR_GRADO V
                    WHERE ID_PERIODO_ESCOLAR = 58 AND V.ID_ALUMNO = ID_ALUMNO
                )

                UNION ALL

                SELECT ID_ALUMNO, PERFIL_PERSONA, NOMBRE_COMPLETO, NOMBRE_GRADO, ESTADO_RESULTADO
                FROM VISTA_RESULTADOS_POR_ALUMNO
                WHERE NIVEL_GRADO = @NIVEL AND ${carrera}
                AND ESTADO_ALUMNO = 'A' AND ESTADO_RESULTADO = 'P'
                AND ID_PERIODO_ESCOLAR = dbo.FUNCION_PERIODO_ANTERIOR(@ID_PERIODO_ESCOLAR)
                AND NOT EXISTS (
                    SELECT * FROM ALUMNOS_POR_GRADO V
                    WHERE ID_PERIODO_ESCOLAR = 58 AND V.ID_ALUMNO = ID_ALUMNO
                )

                UNION ALL

                SELECT V.ID_ALUMNO, V.PERFIL_PERSONA, NOMBRE_COMPLETO, 'Sin grado anterior', 'N'
                FROM VL_PERSONAL_ESCOLAR V
                INNER JOIN ALUMNOS_ESCOLARES E ON E.ID_ALUMNO = V.ID_ALUMNO
                WHERE (SELECT COUNT(*) FROM VL_ALUMNOS_POR_GRADO WHERE ID_ALUMNO = V.ID_ALUMNO) = 0
                AND V.ESTADO_ALUMNO = 'A'
            ) AS RESULTADO
            WHERE NOMBRE_COMPLETO LIKE @NOMBRE
            ORDER BY NOMBRE_COMPLETO
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



module.exports = router;