const express = require('express');
const sql = require('mssql');

const router = express.Router();
router.get('/:idPeriodo/:nombre?', async (req, res) => {
    const { idPeriodo, nombre } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        const request = pool.request();
        request.input('idPeriodo', sql.Int, idPeriodo);

        let countQuery = `SELECT COUNT(*) as total FROM VL_ALUMNOS_POR_GRADO WHERE ID_PERIODO_ESCOLAR = @idPeriodo`;
        let dataQuery = `
            SELECT * FROM VL_ALUMNOS_POR_GRADO
            WHERE ID_PERIODO_ESCOLAR = @idPeriodo
        `;

        if (nombre) {
            request.input('nombre', sql.NVarChar, `%${nombre}%`);
            countQuery += ` AND NOMBRE_ALUMNO LIKE @nombre`;
            dataQuery += ` AND NOMBRE_ALUMNO LIKE @nombre`;
        }

        dataQuery += ` ORDER BY FECHA_INGRESA_REGISTRO DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

        const countResult = await request.query(countQuery);
        const dataResult = await request.query(dataQuery);

        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: dataResult.recordset,
            pagination: { total, totalPages, currentPage: page, limit }
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al buscar alumnos', details: err.message });
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
router.post('/seleccion', async (req, res) => {
    const { ID_PERIODO_ESCOLAR, ID_CARRERA = null, NIVEL } = req.body;

    if (!ID_PERIODO_ESCOLAR || !NIVEL) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    try {
        const pool = await sql.connect();
        const request = pool.request();

        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('NIVEL', sql.Int, NIVEL);

        let gradoCondition = '';
        if (ID_CARRERA === null) {
            gradoCondition = `
                ID_GRADO = (
                    SELECT ID_GRADO 
                    FROM GRADOS_ESCOLARES 
                    WHERE IDENTIFICADOR_CARRERA_ESTUDIANTIL IS NULL 
                    AND NIVEL_GRADO = @NIVEL - 1
                )
            `;
        } else {
            request.input('ID_CARRERA', sql.Int, ID_CARRERA);
            gradoCondition = `
                ID_GRADO = (
                    SELECT ID_GRADO 
                    FROM GRADOS_ESCOLARES 
                    WHERE IDENTIFICADOR_CARRERA_ESTUDIANTIL = @ID_CARRERA 
                    AND NIVEL_GRADO = @NIVEL - 1
                )
            `;
        }

        const query = `
            SELECT V.ID_ALUMNO, V.PERFIL_PERSONA, NOMBRE_COMPLETO, G.NOMBRE_GRADO
            FROM VL_PERSONAL_ESCOLAR V
            INNER JOIN ALUMNOS_ESCOLARES E ON E.ID_ALUMNO = V.ID_ALUMNO
            INNER JOIN VL_ALUMNOS_POR_GRADO A 
                ON A.ID_ALUMNO = V.ID_ALUMNO 
                AND A.ID_PERIODO_ESCOLAR = dbo.FUNCION_PERIODO_ANTERIOR(@ID_PERIODO_ESCOLAR)
                AND ${gradoCondition}
            INNER JOIN GRADOS_ESCOLARES G ON A.ID_GRADO = G.ID_GRADO
            WHERE V.ESTADO_ALUMNO = 'A'
            
            UNION ALL 
            
            SELECT V.ID_ALUMNO, V.PERFIL_PERSONA, NOMBRE_COMPLETO, 'Nuevo ingreso'
            FROM VL_PERSONAL_ESCOLAR V
            INNER JOIN ALUMNOS_ESCOLARES E ON E.ID_ALUMNO = V.ID_ALUMNO
            WHERE (
                SELECT COUNT(*) FROM VL_ALUMNOS_POR_GRADO 
                WHERE ID_ALUMNO = V.ID_ALUMNO
            ) = 0 
            AND V.ESTADO_ALUMNO = 'A';
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