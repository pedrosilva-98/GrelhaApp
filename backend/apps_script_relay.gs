// Relay de email (Google Apps Script). Colar em script.google.com, na conta Gmail da app,
// e publicar como Web app (Executar como: Eu · Acesso: Qualquer pessoa).
// Substituir SECRET pelo mesmo valor definido em APPS_SCRIPT_SECRET no backend.

const SECRET = "COLOCA_AQUI_A_TUA_CHAVE_SECRETA";
const SENDER_NAME = "Caderno de Registo de Avaliação";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SECRET) return out({ ok: false, error: "não autorizado" });

    const pdf = Utilities.newBlob(
      Utilities.base64Decode(data.pdf_base64),
      "application/pdf",
      data.filename || "relatorio.pdf"
    );
    MailApp.sendEmail({
      to: data.to,
      subject: data.subject,
      htmlBody: data.html,
      attachments: [pdf],
      name: SENDER_NAME,
    });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
