const express = require("express")
const sql = require("mssql")
const puppeteer = require("puppeteer")

const router = express.Router() // Declare the router variable
// Endpoint para generar recibo de pago
router.get("/recibo/:correlativo/:periodo", async (req, res) => {
  const { correlativo, periodo } = req.params;

  try {
    // 1️⃣ Obtener datos del pago
    const requestPago = new sql.Request();
    requestPago.input("CORRELATIVO", sql.Int, correlativo);
    requestPago.input("PERIODO", sql.Int, periodo);

    const pagoResult = await requestPago.query(`
      SELECT 
        NOMBRE_COMPLETO, 
        NOMBRE_GRADO, 
        MONTO_PAGADO, 
        CASE TIPO_PAGO 
          WHEN 'I' THEN 'Inscripción' 
          ELSE 'Mensualidad' 
        END AS TIPO_PAGO_DESC,
        CASE MES_DE_PAGO 
          WHEN 1 THEN 'Enero'
          WHEN 2 THEN 'Febrero'
          WHEN 3 THEN 'Marzo'
          WHEN 4 THEN 'Abril'
          WHEN 5 THEN 'Mayo'
          WHEN 6 THEN 'Junio'
          WHEN 7 THEN 'Julio'
          WHEN 8 THEN 'Agosto'
          WHEN 9 THEN 'Septiembre'
          WHEN 10 THEN 'Octubre'
          WHEN 11 THEN 'Noviembre'
          WHEN 12 THEN 'Diciembre'
          ELSE NULL
        END AS MES_PAGO_DESC,
        FECHA_PAGO,
        CORRELATIVO_DE_PAGO,
        TIPO_PAGO,
        MES_DE_PAGO,
        OBSERVACIONES
      FROM PAGOS_COLEGIATURA P 
      INNER JOIN ALUMNOS_POR_GRADO A 
        ON P.ID_ALUMNO = A.ID_ALUMNO 
        AND P.ID_PERIODO_ESCOLAR = A.ID_PERIODO_ESCOLAR 
      INNER JOIN VL_PERSONAL_ESCOLAR V 
        ON A.ID_ALUMNO = V.ID_ALUMNO 
      INNER JOIN GRADOS_ESCOLARES G 
        ON A.ID_GRADO = G.ID_GRADO
      WHERE CORRELATIVO_DE_PAGO = @CORRELATIVO 
        AND P.ID_PERIODO_ESCOLAR = @PERIODO
    `);

    if (pagoResult.recordset.length === 0) {
      return res.status(404).json({ error: "No se encontró el pago especificado" });
    }

    const pago = pagoResult.recordset[0];

    // 2️⃣ Obtener datos de la institución
    const institucionResult = await new sql.Request().query(`
      SELECT 
        NOMBRE_COLEGIO,
        DIRECCION,
        DEPARTAMENTO,
        MUNICIPIO,
        ZONA,
        TELEFONO,
        EMAIL,
        NIT,
        CODIGO_MINEDUC
      FROM INFORMACION_INSTITUCIONAL
    `);

    const institucion = institucionResult.recordset[0] || {};

    // 3️⃣ Generar HTML del recibo
    const html = generarHTMLRecibo(pago, institucion);

    // 4️⃣ Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A6",
      printBackground: true,
      margin: { top: "10px", bottom: "10px", left: "10px", right: "10px" },
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=recibo-${correlativo}.pdf`,
      "Content-Length": pdfBuffer.length,
    });

    res.end(pdfBuffer);
  } catch (error) {
    console.error("❌ Error al generar recibo de pago:", error);
    res.status(500).json({ error: "Error al generar recibo de pago" });
  }
});

// 🖊 Función para generar HTML del recibo
function generarHTMLRecibo(pago, institucion) {
  const fechaPago = new Date(pago.FECHA_PAGO).toLocaleDateString("es-GT");
  const fechaActual = new Date().toLocaleDateString("es-GT");

  let concepto = pago.TIPO_PAGO_DESC;
  if (pago.TIPO_PAGO === "M" && pago.MES_PAGO_DESC) {
    concepto += ` - ${pago.MES_PAGO_DESC}`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Recibo de Pago No. ${pago.CORRELATIVO_DE_PAGO}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 10px; background-color: white; }
        .recibo-container { max-width: 320px; margin: 0 auto; border: 1px solid #000; padding: 10px; background-color: white; }
        .header { text-align: center; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 8px; }
        .logo-section { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .logo-container { width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; }
        .logo-img { max-width: 50px; max-height: 50px; object-fit: contain; border-radius: 50%; }
        .colegio-nombre { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
        .colegio-direccion { font-size: 8px; line-height: 1.1; }
        .numero-recibo { border: 1px solid #000; padding: 6px; font-weight: bold; text-align: center; min-width: 50px; font-size: 10px; }
        .campo { margin-bottom: 8px; display: flex; align-items: center; }
        .campo-label { font-weight: bold; min-width: 70px; margin-right: 8px; font-size: 9px; }
        .campo-valor { flex: 1; border-bottom: 1px solid #000; padding-bottom: 1px; min-height: 14px; font-size: 9px; }
        .monto-section { border: 1px solid #000; padding: 8px; margin: 10px 0; text-align: center; background-color: #f9f9f9; }
        .monto-label { font-weight: bold; font-size: 10px; margin-bottom: 3px; }
        .monto-valor { font-size: 14px; font-weight: bold; color: #2d5016; }
        .firmas-section { margin-top: 15px; display: flex; justify-content: space-between; align-items: end; }
        .firma-linea { border-bottom: 1px solid #000; height: 30px; margin-bottom: 3px; position: relative; }
        .firma-texto { font-size: 8px; font-weight: bold; }
        .sello-area { border: 1px dashed #666; height: 40px; width: 60px; margin: 8px auto; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #666; }
        .fecha-emision { text-align: right; font-size: 8px; margin-top: 8px; font-style: italic; }
      </style>
    </head>
    <body>
      <div class="recibo-container">
        <div class="header">
          <div class="logo-section">
            <div class="logo-container">
              <img src="http://127.0.0.1:8000/images/image.webp" alt="Logo Colegio" class="logo-img">
            </div>
            <div class="colegio-info">
              <div class="colegio-nombre">${institucion.NOMBRE_COLEGIO || ""}</div>
              <div class="colegio-direccion">
                ${institucion.DIRECCION || ""}<br>
                ${institucion.MUNICIPIO || ""}, ${institucion.DEPARTAMENTO || ""} Zona ${institucion.ZONA || ""}<br>
                Tel: ${institucion.TELEFONO || ""}<br>
                ${institucion.EMAIL || ""}<br>
                NIT: ${institucion.NIT || ""}<br>
                Código MINEDUC: ${institucion.CODIGO_MINEDUC || ""}
              </div>
            </div>
            <div class="numero-recibo">
              No. ${pago.CORRELATIVO_DE_PAGO.toString().padStart(3, "0")}
            </div>
          </div>
        </div>

        <div class="campo">
          <div class="campo-label">Nombre:</div>
          <div class="campo-valor">${pago.NOMBRE_COMPLETO}</div>
        </div>

        <div class="campo">
          <div class="campo-label">Por:</div>
          <div class="campo-valor">${concepto}</div>
        </div>

        <div class="campo">
          <div class="campo-label">Grado:</div>
          <div class="campo-valor">${pago.NOMBRE_GRADO}</div>
        </div>

        <div class="campo">
          <div class="campo-label">Fecha:</div>
          <div class="campo-valor">${fechaPago}</div>
        </div>

        <div class="monto-section">
          <div class="monto-label">MONTO PAGADO</div>
          <div class="monto-valor">Q ${Number.parseFloat(pago.MONTO_PAGADO).toFixed(2)}</div>
        </div>

        <div class="campo">
          <div class="campo-label">Observaciones:</div>
          <div class="campo-valor">${pago.OBSERVACIONES || "Sin observaciones"}</div>
        </div>

        <div class="firmas-section">
          <div class="firma-box">
            <div class="firma-linea"></div>
            <div class="firma-texto">RECIBÍ CONFORME</div>
          </div>
          <div class="firma-box">
            <div class="sello-area">SELLO</div>
            <div class="firma-texto">AUTORIZADO</div>
          </div>
        </div>

        <div class="fecha-emision">
          Generado el: ${fechaActual}
        </div>
      </div>
    </body>
    </html>
  `;
}


module.exports = router