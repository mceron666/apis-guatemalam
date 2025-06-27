const express = require('express');
const sql = require('mssql');

const router = express.Router();

// Obtener todos o por código de grado
router.get('/:codigoGrado?/:forma?', async (req, res) => {
    const { codigoGrado, forma } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    let campo = 'CODIGO_GRADO';
    if (forma && forma !== '') {
        campo = 'ID_GRADO';
    }
    try {
        const pool = await sql.connect();
        let countQuery = `
            SELECT COUNT(*) as total
            FROM VL_GRADOS_ESCOLARES
        `;
        
        let dataQuery = `
            SELECT 
                ID_GRADO,
                CODIGO_GRADO,
                NOMBRE_GRADO,
                SECCION_GRADO,
                NIVEL_GRADO,
                CODIGO_CARRERA,
                DESCRIPCION_CARRERA,
                IDENTIFICADOR_CARRERA_ESTUDIANTIL,
                PERFIL_PERSONA,
                ID_PERSONA_INGRESO
            FROM VL_GRADOS_ESCOLARES
        `;

        const request = pool.request();
        const countRequest = pool.request();

        if (codigoGrado) {
            dataQuery += ` WHERE ${campo} = @codigoGrado`;
            countQuery += ` WHERE ${campo} = @codigoGrado`;
            request.input('codigoGrado', sql.VarChar, codigoGrado);
            countRequest.input('codigoGrado', sql.VarChar, codigoGrado);
        }

        dataQuery += ` ORDER BY ID_GRADO DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

        const result = await request.query(dataQuery);
        const countResult = await countRequest.query(countQuery);

        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: result.recordset,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        res.status(500).json({
            error: 'Error al obtener los grados escolares',
            details: err.message
        });
    }
});

// Búsqueda por nombre de grado o descripción de carrera
router.get('/busqueda/:variable/busqueda', async (req, res) => {
    const { variable } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();

        const countResult = await pool.request()
            .input('busqueda', sql.NVarChar, `%${variable}%`)
            .query(`
                SELECT COUNT(*) as total
                FROM VL_GRADOS_ESCOLARES
                WHERE NOMBRE_GRADO LIKE @busqueda
                OR DESCRIPCION_CARRERA LIKE @busqueda
            `);

        const dataResult = await pool.request()
            .input('busqueda', sql.NVarChar, `%${variable}%`)
            .query(`
                SELECT 
                    ID_GRADO,
                    CODIGO_GRADO,
                    NOMBRE_GRADO,
                    SECCION_GRADO,
                    NIVEL_GRADO,
                    CODIGO_CARRERA,
                    DESCRIPCION_CARRERA,
                    IDENTIFICADOR_CARRERA_ESTUDIANTIL,
                    PERFIL_PERSONA,
                    ID_PERSONA_INGRESO
                FROM VL_GRADOS_ESCOLARES
                WHERE NOMBRE_GRADO LIKE @busqueda
                OR DESCRIPCION_CARRERA LIKE @busqueda
                ORDER BY ID_GRADO DESC
                OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
            `);

        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: dataResult.recordset,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        res.status(500).json({
            error: 'Error al buscar grados escolares',
            details: err.message
        });
    }
});

// Registrar, actualizar o eliminar grado usando procedimiento almacenado
router.post('/', async (req, res) => {
    const {
        CODIGO_GRADO,
        NOMBRE_GRADO,
        SECCION_GRADO,
        NIVEL_GRADO,
        IDENTIFICADOR_CARRERA_ESTUDIANTIL,
        ID_PERSONA_INGRESO,
        ACCION
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('CODIGO_GRADO', sql.VarChar(20), CODIGO_GRADO);
        request.input('NOMBRE_GRADO', sql.VarChar(50), NOMBRE_GRADO);
        request.input('SECCION_GRADO', sql.Char(1), SECCION_GRADO);
        request.input('NIVEL_GRADO', sql.Int, NIVEL_GRADO);
        request.input('IDENTIFICADOR_CARRERA_ESTUDIANTIL', sql.Int, IDENTIFICADOR_CARRERA_ESTUDIANTIL);
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_GRADOS_ESCOLARES');
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