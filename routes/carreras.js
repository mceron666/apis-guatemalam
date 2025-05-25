const express = require('express');
const sql = require('mssql');

const router = express.Router();

// Obtener todas las carreras o una específica por código
router.get('/seleccion', async (req, res) => {
    try {
        const pool = await sql.connect();
        let query = `
            SELECT *
            FROM VL_CARRERAS_ESTUDIANTILES
        `;
        const request = pool.request();
        query += ` ORDER BY FECHA_INGRESA_REGISTRO DESC`;

        const result = await request.query(query);

        res.json({ data: result.recordset });
    } catch (err) {
        res.status(500).json({
            error: 'Error al obtener las carreras',
            details: err.message
        });
    }
});

router.get('/:codigoCarrera?', async (req, res) => {
    const { codigoCarrera } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        let countQuery = `SELECT COUNT(*) as total FROM VL_CARRERAS_ESTUDIANTILES`;
        let dataQuery = `
            SELECT *
            FROM VL_CARRERAS_ESTUDIANTILES
        `;
        const request = pool.request();
        const countRequest = pool.request();

        if (codigoCarrera) {
            dataQuery += ` WHERE CODIGO_CARRERA = @codigoCarrera`;
            countQuery += ` WHERE CODIGO_CARRERA = @codigoCarrera`;
            request.input('codigoCarrera', sql.VarChar, codigoCarrera);
            countRequest.input('codigoCarrera', sql.VarChar, codigoCarrera);
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
        res.status(500).json({ error: 'Error al obtener las carreras', details: err.message });
    }
});

// Búsqueda de carreras por descripción
router.get('/busqueda/:variable', async (req, res) => {
    const { variable } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        
        const countResult = await pool.request()
            .input('descripcion', sql.NVarChar, `%${variable}%`)
            .query(`SELECT COUNT(*) as total FROM VL_CARRERAS_ESTUDIANTILES WHERE DESCRIPCION_CARRERA LIKE @descripcion`);
        
        const dataResult = await pool.request()
            .input('descripcion', sql.NVarChar, `%${variable}%`)
            .query(`
                SELECT * FROM VL_CARRERAS_ESTUDIANTILES
                WHERE DESCRIPCION_CARRERA LIKE @descripcion
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
        res.status(500).json({ error: 'Error al buscar la carrera', details: err.message });
    }
});

// Insertar, actualizar o eliminar carreras
router.post('/', async (req, res) => {
    const {
        CODIGO_CARRERA,
        DESCRIPCION_CARRERA,
        TIPO_CARRERA,
        ANIOS_DURACION,
        ID_PERSONA_INGRESO,
        ACCION
    } = req.body;
    try {
        const request = new sql.Request();
        request.input('CODIGO_CARRERA', sql.VarChar(15), CODIGO_CARRERA);
        request.input('DESCRIPCION_CARRERA', sql.VarChar(50), DESCRIPCION_CARRERA);
        request.input('TIPO_CARRERA', sql.Char(1), TIPO_CARRERA);
        request.input('ANIOS_DURACION', sql.Int, ANIOS_DURACION);
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));

        const result = await request.execute('PROCEDIMIENTO_CARRERAS_ESTUDIANTILES');
        const mensaje = result.output.MENSAJE || '';

        // if (mensaje.trim() !== ''){
        //     return res.status(400).json({ mensaje: mensaje });
        // }

        res.status(200).json({ mensaje });

    } catch (err) {
        res.status(500).json({ error: 'Error ejecutando el procedimiento', details: err.message });
    }
});

module.exports = router;