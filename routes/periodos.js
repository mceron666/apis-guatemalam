const express = require('express');
const sql = require('mssql');

const router = express.Router();
router.get('/seleccion', async (req, res) => {

    try {
        const pool = await sql.connect();
        const request = pool.request();

        let query = `
            SELECT 
                ID_PERIODO_ESCOLAR,
                CODIGO_PERIODO,
                DESCRIPCION_PERIODO
            FROM VL_PERIODOS_ESCOLARES
            WHERE FECHA_INICIO_PERIODO <= GETDATE()
        `;

        query += ` ORDER BY FECHA_INICIO_PERIODO DESC`;

        const result = await request.query(query);
        res.json(result.recordset);

    } catch (err) {
        res.status(500).json({
            error: 'Error al obtener los períodos escolares',
            details: err.message
        });
    }
});
router.get('/:codigoPeriodo?', async (req, res) => {
    const { codigoPeriodo } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        let countQuery = `
            SELECT COUNT(*) as total
            FROM VL_PERIODOS_ESCOLARES
        `;

        let dataQuery = `
            SELECT 
                ID_PERIODO_ESCOLAR,
                CODIGO_PERIODO,
                DESCRIPCION_PERIODO,
                FECHA_INICIO_PERIODO,
                FECHA_FINALIZA_PERIODO,
                ESTADO_PERIODO,
                DESCRIPCION_ESTADO_PERIODO, 
                FECHA_INGRESA_REGISTRO,
                FECHA_ULTIMA_ACTUALIZACION,
                ID_PERSONA_INGRESO, 
                PERFIL_PERSONA, 
                NOMBRES_PERSONA
            FROM VL_PERIODOS_ESCOLARES 
        `;

        const request = pool.request();
        const countRequest = pool.request();

        if (codigoPeriodo) {
            dataQuery += ` WHERE CODIGO_PERIODO = @codigoPeriodo`;
            countQuery += ` WHERE CODIGO_PERIODO = @codigoPeriodo`;
            request.input('codigoPeriodo', sql.VarChar, codigoPeriodo);
            countRequest.input('codigoPeriodo', sql.VarChar, codigoPeriodo);
        }

        dataQuery += ` ORDER BY FECHA_INICIO_PERIODO DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

        const result = await request.query(dataQuery);
        const countResult = await countRequest.query(countQuery);

        const periodos = result.recordset;
        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        // Ahora obtenemos los bloques si hay periodos
        let dataConBloques = [];
        if (periodos.length > 0) {
            const idsPeriodo = periodos.map(p => p.ID_PERIODO_ESCOLAR);
            const bloquesRequest = pool.request();

            const placeholders = idsPeriodo.map((_, i) => `@id${i}`).join(', ');
            idsPeriodo.forEach((id, i) => {
                bloquesRequest.input(`id${i}`, sql.Int, id);
            });

            const bloquesQuery = `
                SELECT 
                    ID_PERIODO_ESCOLAR,
                    NUMERO_BLOQUE,
                    NOMBRE_BLOQUE,
                    FECHA_INICIO_BLOQUE,
                    FECHA_FINALIZA_BLOQUE
                FROM BLOQUES_ESCOLARES
                WHERE ID_PERIODO_ESCOLAR IN (${placeholders})
            `;

            const bloquesResult = await bloquesRequest.query(bloquesQuery);
            const bloquesPorPeriodo = {};

            bloquesResult.recordset.forEach(b => {
                if (!bloquesPorPeriodo[b.ID_PERIODO_ESCOLAR]) {
                    bloquesPorPeriodo[b.ID_PERIODO_ESCOLAR] = [];
                }
                bloquesPorPeriodo[b.ID_PERIODO_ESCOLAR].push({
                    NUMERO_BLOQUE: b.NUMERO_BLOQUE,
                    NOMBRE_BLOQUE: b.NOMBRE_BLOQUE,
                    FECHA_INICIO_BLOQUE: b.FECHA_INICIO_BLOQUE,
                    FECHA_FINALIZA_BLOQUE: b.FECHA_FINALIZA_BLOQUE
                });
            });

            // Agregamos los bloques al período correspondiente
            dataConBloques = periodos.map(p => ({
                ...p,
                bloques: bloquesPorPeriodo[p.ID_PERIODO_ESCOLAR] || []
            }));
        }

        res.json({
            data: dataConBloques,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        res.status(500).json({
            error: 'Error al obtener los períodos escolares',
            details: err.message
        });
    }
});
router.get('/busqueda/:variable', async (req, res) => {
    const { variable } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        
        // Consulta para contar registros
        const countResult = await pool.request()
            .input('descripcion', sql.NVarChar, `%${variable}%`)
            .query(`
                SELECT COUNT(*) as total
                FROM VL_PERIODOS_ESCOLARES
                WHERE DESCRIPCION_PERIODO LIKE @descripcion
            `);
        
        // Consulta para obtener registros paginados
        const dataResult = await pool.request()
            .input('descripcion', sql.NVarChar, `%${variable}%`)
            .query(`
                SELECT 
                    CODIGO_PERIODO,
                    DESCRIPCION_PERIODO,
                    FECHA_INICIO_PERIODO,
                    FECHA_FINALIZA_PERIODO,
                    ESTADO_PERIODO,
                    DESCRIPCION_ESTADO_PERIODO, 
                    FECHA_INGRESA_REGISTRO,
                    FECHA_ULTIMA_ACTUALIZACION,
                    ID_PERSONA_INGRESO, 
                    PERFIL_PERSONA, 
                    NOMBRES_PERSONA
                FROM VL_PERIODOS_ESCOLARES
                WHERE DESCRIPCION_PERIODO LIKE @descripcion
                ORDER BY FECHA_INICIO_PERIODO DESC
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
            error: 'Error al buscar el período escolar', 
            details: err.message 
        });
    }
});
router.post('/', async (req, res) => {
    const {
        CODIGO_PERIODO,
        DESCRIPCION_PERIODO,
        FECHA_INICIO_PERIODO,
        FECHA_FINALIZA_PERIODO,
        FECHA_INICIO_BLOQUE_1,
        FECHA_FINALIZA_BLOQUE_1,      
        FECHA_INICIO_BLOQUE_2,
        FECHA_FINALIZA_BLOQUE_2,   
        FECHA_INICIO_BLOQUE_3,
        FECHA_FINALIZA_BLOQUE_3,   
        FECHA_INICIO_BLOQUE_4,
        FECHA_FINALIZA_BLOQUE_4,                             
        ESTADO_PERIODO,
        ID_PERSONA_INGRESO,
        ACCION
    } = req.body;
    try {
        const request = new sql.Request();
        request.input('CODIGO_PERIODO', sql.VarChar(15), CODIGO_PERIODO);
        request.input('DESCRIPCION_PERIODO', sql.VarChar(50), DESCRIPCION_PERIODO);
        request.input('FECHA_INICIO_PERIODO', sql.Date, FECHA_INICIO_PERIODO);
        request.input('FECHA_FINALIZA_PERIODO', sql.Date, FECHA_FINALIZA_PERIODO);
        request.input('FECHA_INICIO_BLOQUE_1', sql.Date, FECHA_INICIO_BLOQUE_1);
        request.input('FECHA_FINALIZA_BLOQUE_1', sql.Date, FECHA_FINALIZA_BLOQUE_1);
        request.input('FECHA_INICIO_BLOQUE_2', sql.Date, FECHA_INICIO_BLOQUE_2);
        request.input('FECHA_FINALIZA_BLOQUE_2', sql.Date, FECHA_FINALIZA_BLOQUE_2);
        request.input('FECHA_INICIO_BLOQUE_3', sql.Date, FECHA_INICIO_BLOQUE_3);
        request.input('FECHA_FINALIZA_BLOQUE_3', sql.Date, FECHA_FINALIZA_BLOQUE_3);
        request.input('FECHA_INICIO_BLOQUE_4', sql.Date, FECHA_INICIO_BLOQUE_4);
        request.input('FECHA_FINALIZA_BLOQUE_4', sql.Date, FECHA_FINALIZA_BLOQUE_4);  
        request.input('ESTADO_PERIODO', sql.Char(1), ESTADO_PERIODO);
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));
        const result = await request.execute('PROCEDIMIENTO_PERIODOS_ESCOLARES');

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