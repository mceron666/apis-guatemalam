const express = require('express');
const sql = require('mssql');

const router = express.Router();
router.get('/maestros', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        let countQuery = `SELECT COUNT(*) as total FROM VL_PERSONAL_ESCOLAR`;
        let dataQuery = `
            SELECT 
                ID_PERSONA,
                NOMBRE_COMPLETO,
                ID_MAESTRO
            FROM VL_PERSONAL_ESCOLAR
            WHERE ESTADO_MAESTRO = 'A' and ROL_PERSONA IN ('M', 'P')
        `;

        const request = pool.request();
        const countRequest = pool.request();

        dataQuery += ` ORDER BY NOMBRE_COMPLETO ASC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

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
            error: 'Error al obtener el personal escolar',
            details: err.message
        });
    }
});
router.get('/administradores', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        let countQuery = `SELECT COUNT(*) as total FROM VL_PERSONAL_ESCOLAR`;
        let dataQuery = `
            SELECT 
                ID_PERSONA,
                NOMBRE_COMPLETO
            FROM VL_PERSONAL_ESCOLAR
            WHERE ROL_PERSONA IN ('G', 'P')
        `;

        const request = pool.request();
        const countRequest = pool.request();

        dataQuery += ` ORDER BY NOMBRE_COMPLETO ASC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

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
            error: 'Error al obtener el personal escolar',
            details: err.message
        });
    }
});
router.get('/:codigoPerfil?', async (req, res) => {
    const { codigoPerfil } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const pool = await sql.connect();
        let countQuery = `SELECT COUNT(*) as total FROM VL_PERSONAL_ESCOLAR`;
        let dataQuery = `
            SELECT 
                ID_PERSONA,
                NOMBRES_PERSONA,
                APELLIDOS_PERSONA,
                PERFIL_PERSONA,
                CORREO_PERSONA,
                SEXO_PERSONA,
                ROL_PERSONA,
                NUMERO_PERSONA,
                NOMBRE_COMPLETO,
                ID_MAESTRO,
                ESPECIALIDAD,
                TITULO_ACADEMICO,
                ESTADO_MAESTRO,
                FECHA_INGRESO_MAESTRO,
                FECHA_ACTUALIZACION_MAESTRO,
                SALARIO_ACTUAL,
                NUMERO_DPI,
                ID_ALUMNO,
                NOMBRE_CONTACTO_1,
                NUMERO_CONTACTO_1,
                NOMBRE_CONTACTO_2,
                NUMERO_CONTACTO_2,
                ESTADO_ALUMNO,
                FECHA_INGRESA_REGISTRO,
                FECHA_ULTIMA_ACTUALIZACION,
                PERFIL_PERSONA_INGRESO,
                NOMBRE_USUARIO_INGRESO, 
                DEBE_CAMBIAR_PASSWORD, 
                ID_PERIODO_ESCOLAR, 
                CODIGO_PERIODO, 
                DESCRIPCION_PERIODO, 
                MES_INGRESO_ESTUDIANTE                
            FROM VL_PERSONAL_ESCOLAR
        `;

        const request = pool.request();
        const countRequest = pool.request();

        if (codigoPerfil) {
            dataQuery += ` WHERE PERFIL_PERSONA = @codigoPerfil`;
            countQuery += ` WHERE PERFIL_PERSONA = @codigoPerfil`;
            request.input('codigoPerfil', sql.VarChar(20), codigoPerfil);
            countRequest.input('codigoPerfil', sql.VarChar(20), codigoPerfil);
        }

        dataQuery += ` ORDER BY NOMBRE_COMPLETO ASC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;

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
            error: 'Error al obtener el personal escolar',
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

        const searchInput = `%${variable}%`;

        const countResult = await pool.request()
            .input('nombreCompleto', sql.NVarChar, searchInput)
            .query(`
                SELECT COUNT(*) as total
                FROM VL_PERSONAL_ESCOLAR
                WHERE NOMBRE_COMPLETO LIKE @nombreCompleto
            `);

        const dataResult = await pool.request()
            .input('nombreCompleto', sql.NVarChar, searchInput)
            .query(`
                SELECT 
                    ID_PERSONA,
                    NOMBRES_PERSONA,
                    APELLIDOS_PERSONA,
                    PERFIL_PERSONA,
                    CORREO_PERSONA,
                    SEXO_PERSONA,
                    ROL_PERSONA,
                    NUMERO_PERSONA,
                    NOMBRE_COMPLETO,
                    ID_MAESTRO,
                    ESPECIALIDAD,
                    TITULO_ACADEMICO,
                    ESTADO_MAESTRO,
                    FECHA_INGRESO_MAESTRO,
                    FECHA_ACTUALIZACION_MAESTRO,
                    SALARIO_ACTUAL,
                    NUMERO_DPI,
                    ID_ALUMNO,
                    NOMBRE_CONTACTO_1,
                    NUMERO_CONTACTO_1,
                    NOMBRE_CONTACTO_2,
                    NUMERO_CONTACTO_2,
                    ESTADO_ALUMNO,
                    FECHA_INGRESA_REGISTRO,
                    FECHA_ULTIMA_ACTUALIZACION,
                    PERFIL_PERSONA_INGRESO,
                    NOMBRE_USUARIO_INGRESO, 
                    DEBE_CAMBIAR_PASSWORD                    
                FROM VL_PERSONAL_ESCOLAR
                WHERE NOMBRE_COMPLETO LIKE @nombreCompleto
                ORDER BY NOMBRE_COMPLETO ASC
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
            error: 'Error al buscar el personal escolar',
            details: err.message
        });
    }
});

router.post('/', async (req, res) => {
    const {
        NOMBRES_PERSONA,
        APELLIDOS_PERSONA,
        CORREO_PERSONA,
        PERFIL_PERSONA,
        SEXO_PERSONA,
        ROL_PERSONA,
        NUMERO_PERSONA,
        ID_PERSONA_INGRESO,
        ESPECIALIDAD,
        TITULO_ACADEMICO,
        SALARIO_ACTUAL,
        NUMERO_DPI,
        NOMBRE_CONTACTO_1,
        NUMERO_CONTACTO_1,
        NOMBRE_CONTACTO_2,
        NUMERO_CONTACTO_2,
        ID_PERIODO_ESCOLAR,
        MES_INGRESO,       
        ACCION
    } = req.body;

    try {
        const request = new sql.Request();

        // Campos existentes
        request.input('NOMBRES_PERSONA', sql.VarChar(50), NOMBRES_PERSONA);
        request.input('APELLIDOS_PERSONA', sql.VarChar(50), APELLIDOS_PERSONA);
        request.input('CORREO_PERSONA', sql.VarChar(50), CORREO_PERSONA);
        request.input('PERFIL_PERSONA', sql.VarChar(20), PERFIL_PERSONA);
        request.input('SEXO_PERSONA', sql.Char(1), SEXO_PERSONA);
        request.input('ROL_PERSONA', sql.Char(1), ROL_PERSONA);
        request.input('NUMERO_PERSONA', sql.VarChar(15), NUMERO_PERSONA);
        request.input('ID_PERSONA_INGRESO', sql.Int, ID_PERSONA_INGRESO);
        request.input('ESPECIALIDAD', sql.VarChar(50), ESPECIALIDAD);
        request.input('TITULO_ACADEMICO', sql.VarChar(100), TITULO_ACADEMICO);
        request.input('SALARIO_ACTUAL', sql.Decimal(11, 2), SALARIO_ACTUAL);
        request.input('NUMERO_DPI', sql.VarChar(13), NUMERO_DPI);
        request.input('NOMBRE_CONTACTO_1', sql.VarChar(100), NOMBRE_CONTACTO_1);
        request.input('NUMERO_CONTACTO_1', sql.VarChar(15), NUMERO_CONTACTO_1);
        request.input('NOMBRE_CONTACTO_2', sql.VarChar(100), NOMBRE_CONTACTO_2);
        request.input('NUMERO_CONTACTO_2', sql.VarChar(15), NUMERO_CONTACTO_2);
        request.input('ID_PERIODO_ESCOLAR', sql.Int, ID_PERIODO_ESCOLAR);
        request.input('MES_INGRESO', sql.Int, MES_INGRESO);

        request.input('ACCION', sql.Char(1), ACCION);
        request.output('MENSAJE', sql.NVarChar(255));

        // Ejecutar procedimiento almacenado
        const result = await request.execute('PROCEDIMIENTO_PERSONAL_COLEGIO');
        const mensaje = result.output.MENSAJE || '';

        // Respuesta al cliente
        res.status(200).json({ mensaje });

    } catch (err) {
        res.status(500).json({
            error: 'Error ejecutando el procedimiento',
            details: err.message
        });
    }
});

router.post('/control/login', async (req, res) => {
    const page = parseInt(req.body.page) || 1;
    const limit = parseInt(req.body.limit) || 10;
    const offset = (page - 1) * limit;

    const { nombre, fechaInicio, fechaFin } = req.body;

    try {
        const pool = await sql.connect();
        let whereClauses = [];
        let request = pool.request();

        // Filtro por nombre
        if (nombre) {
            request.input('nombre', sql.NVarChar, `%${nombre}%`);
            whereClauses.push("V.NOMBRE_COMPLETO LIKE @nombre");
        }

        // Filtro por rango de fechas
        if (fechaInicio && fechaFin) {
            request.input('fechaInicio', sql.DateTime, fechaInicio);
            request.input('fechaFin', sql.DateTime, fechaFin);
            whereClauses.push("C.FECHA_HORA_INGRESO BETWEEN @fechaInicio AND @fechaFin");
        } else if (fechaInicio) {
            request.input('fechaInicio', sql.DateTime, fechaInicio);
            whereClauses.push("C.FECHA_HORA_INGRESO >= @fechaInicio");
        } else if (fechaFin) {
            request.input('fechaFin', sql.DateTime, fechaFin);
            whereClauses.push("C.FECHA_HORA_INGRESO <= @fechaFin");
        }

        // Construcción dinámica del WHERE
        let whereSQL = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

        // 1. Total de registros con filtros
        const countQuery = `
            SELECT COUNT(*) as total
            FROM CONTROL_LOGIN C
            INNER JOIN VL_PERSONAL_ESCOLAR V ON C.ID_PERSONA = V.ID_PERSONA
            ${whereSQL}
        `;
        const countResult = await request.query(countQuery);

        // 2. Datos con paginación
        const dataQuery = `
            SELECT 
                V.NOMBRE_COMPLETO, 
                C.DISPOSITIVO_ACCEDE, 
                C.IP_ACCESO, 
                C.LATITUD, 
                C.LONGITUD, 
                C.LUGAR_ACCESO, 
                C.FECHA_HORA_INGRESO
            FROM CONTROL_LOGIN C
            INNER JOIN VL_PERSONAL_ESCOLAR V ON C.ID_PERSONA = V.ID_PERSONA
            ${whereSQL}
            ORDER BY C.FECHA_HORA_INGRESO DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;
        const dataResult = await request.query(dataQuery);

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
            error: 'Error al obtener el historial de accesos',
            details: err.message
        });
    }
});


module.exports = router;