// Envío de correo con Resend. Sin RESEND_API_KEY no se envía nada (solo desarrollo).
export async function sendActivationCode(to: string, role: string, code: string): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.warn(`[mail] RESEND_API_KEY/MAIL_FROM sin configurar; no se envió el código a ${to}.`);
    return { sent: false };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to, subject: `Te invitaron a SEN · Rol: ${role}`,
      text: `Tu código de invitación a SEN es ${code}. Vale por 15 minutos.\nRol asignado: ${role}.`,
    }),
  });
  if (!res.ok) console.error("[mail] Resend respondió", res.status);
  return { sent: res.ok };
}
