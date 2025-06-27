const express = require('express');
const sql = require('mssql');

const router = express.Router();

// Obtener todas las materias o una específica por código
router.get('/:codigoMateria?/:forma?', async (req, res) => {
    const { codigoMateria, forma } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    let campo = 'CODIGO_MATERIA';
    if (forma && forma !== '') {
        campo = 'ID_MATERIA';
    }

    try {
        const pool = await sql.connect();
        let countQuery = `SELECT COUNT(*) as total FROM VL_MATERIAS_ESCOLARES`;
        let dataQuery = `SELECT * FROM VL_MATERIAS_ESCOLARES`;
        const request = pool.request();
        const countRequest = pool.request();

        if (codigoMateria) {
            dataQuery += ` WHERE ${campo} = @codigoMateria`;
            countQuery += ` WHERE ${campo} = @codigoMateria`;
            request.input('codigoMateria', sql.VarChar, codigoMateria);
            countRequest.input('codigoMateria', sql.VarChar, codigoMateria);
        }

        dataQuery += ` ORDER BY FECHA_INGRESA_REGISTRO DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

        const result = await request.query(dataQuery);
        const countResult = await countRequest.query(countQuery);

        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: result.recordset,
            pagination: { total, totalPages, currentPage: page, limit }
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener las materias', details: err.message });
    }
});


// Búsqueda de materias por nombre
router.get('/busqueda/:variable/busqueda', async (req, res) => {
    const { variable } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();

        const countResult = await pool.request()
            .input('nombre', sql.NVarChar, `%${variable}%`)
            .query(`SELECT COUNT(*) as total FROM VL_MATERIAS_ESCOLARES WHERE NOMBRE_MATERIA LIKE @nombre`);

        const dataResult = await pool.request()
            .input('nombre', sql.NVarChar, `%${variable}%`)
            .query(`
                SELECT * FROM VL_MATERIAS_ESCOLARES
                WHERE NOMBRE_MATERIA LIKE @nombre
                ORDER BY FECHA_INGRESA_REGISTRO DESC
                OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
            `);

        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            data: dataResult.recordset,
            pagination: { total, totalPages, currentPage: page, limit }
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al buscar la materia', details: err.message });
    }
});

// Insertar, actualizar o eliminar materias
router.post('/', async (req, res) => {
    const {
        CODIGO_MATERIA,
        NOMBRE_MATERIA,
        ID_PERSONA_INGRESO,
        COLOR_MATERIA, 
        USA_LETRAS_BLANCAS,
        ESTADO_MATERIA,
        ACCION
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('CODIGO_MATERIA', sql.VarChar(15), CODIGO_MATERIA);
        request.input('NOMBRE_MATERIA', sql.VarChar(50), NOMBRE_MATERIA);
        request.input('COLOR_MATERIA', sql.Char(7), COLOR_MATERIA);
        request.input('USA_LETRAS_BLANCAS', sql.Char(1), USA_LETRAS_BLANCAS);
        request.input('ESTADO_MATERIA', sql.Char(1), ESTADO_MATERIA);        
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_MATERIAS_ESCOLARES');
        const mensaje = result.output.MENSAJE || '';

        // if (mensaje.trim() !== '') {
        //     return res.status(400).json({ mensaje });
        // }

        res.status(200).json({ mensaje });

    } catch (err) {
        res.status(500).json({ error: 'Error ejecutando el procedimiento', details: err.message });
    }
});

module.exports = router;