// Zero-dependency generator for the Supabase Auth email templates (Dashboard > Authentication > Emails).
// Renders one shared layout for the six templates into dist/*.html plus dist/subjects.json.
// Run with: node supabase/templates/build.mjs   (then paste, or `node supabase/templates/push.mjs`)
//
// Links go to OUR app, not the Supabase verify endpoint:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>
// /auth/confirm shows a "Continue" button; only that POST calls verifyOtp, so email scanners
// that prefetch the link can't burn the one-time token. See app/auth/confirm/.
//
// To restyle: replace layout() below (header, card, button, footer). Content lives in TEMPLATES.

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, 'dist')

const BRAND = {
  navy: '#000056',
  accent: '#3763d9',
  bg: '#eef1f8',
  border: '#dde2f0',
  text: '#18203a',
  muted: '#5b6486',
  faint: '#8a92b2',
  font: "Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif",
}

const SITE = '{{ .SiteURL }}'
const confirmUrl = (type) => `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}`
const GREETING_PT = 'Olá{{ if .Data.full_name }} {{ .Data.full_name }}{{ end }},'
const GREETING_EN = 'Hi{{ if .Data.full_name }} {{ .Data.full_name }}{{ end }},'

// pt is the primary language; en is shown below the divider.
const TEMPLATES = [
  {
    file: 'confirm-signup',
    subject: 'Confirme o seu email · Confirm your email',
    preheader: 'Confirme o seu endereço de email para ativar a conta.',
    pt: {
      heading: 'Confirme o seu email',
      paragraphs: [GREETING_PT, 'Obrigado por criar uma conta no Sophi Sports. Confirme o seu endereço de email para ativar o acesso.'],
      button: 'Confirmar email',
    },
    en: {
      heading: 'Confirm your email',
      paragraphs: ['Thanks for creating a Sophi Sports account. Use the button above to confirm your email address.'],
    },
    link: confirmUrl('email'),
  },
  {
    file: 'invite',
    subject: 'Convite para o Sophi Sports · You are invited',
    preheader: 'Aceite o convite e escolha a sua palavra-passe.',
    pt: {
      heading: 'Bem-vindo ao Sophi Sports',
      paragraphs: [GREETING_PT, 'Foi convidado(a) para aceder ao Sophi Sports. Aceite o convite e escolha a sua palavra-passe para começar.'],
      button: 'Aceitar convite',
    },
    en: {
      heading: "You've been invited to Sophi Sports",
      paragraphs: [GREETING_EN, 'Use the button above to accept the invitation and choose your password.'],
    },
    link: confirmUrl('invite'),
  },
  {
    file: 'magic-link',
    subject: 'O seu link de acesso · Your sign-in link',
    preheader: 'Entre no Sophi Sports com um clique ou com o código.',
    pt: {
      heading: 'Entrar no Sophi Sports',
      paragraphs: [GREETING_PT, 'Use o botão abaixo para entrar, ou introduza o código de uso único.'],
      button: 'Entrar',
    },
    en: {
      heading: 'Sign in to Sophi Sports',
      paragraphs: ['Use the button above to sign in, or enter the one-time code.'],
    },
    code: true,
    link: confirmUrl('email'),
  },
  {
    file: 'change-email',
    subject: 'Confirme o novo email · Confirm your new email',
    preheader: 'Confirme o novo endereço de email da sua conta.',
    pt: {
      heading: 'Confirme o novo email',
      paragraphs: ['Recebemos um pedido para alterar o email da sua conta para <strong>{{ .NewEmail }}</strong>. Confirme para concluir a alteração.'],
      button: 'Confirmar novo email',
    },
    en: {
      heading: 'Confirm your new email',
      paragraphs: ['We received a request to change your account email to <strong>{{ .NewEmail }}</strong>. Use the button above to confirm.'],
    },
    link: confirmUrl('email_change'),
  },
  {
    file: 'reset-password',
    subject: 'Redefinir palavra-passe · Reset your password',
    preheader: 'Escolha uma nova palavra-passe para a sua conta.',
    pt: {
      heading: 'Redefinir palavra-passe',
      paragraphs: [GREETING_PT, 'Recebemos um pedido para redefinir a palavra-passe da sua conta. Clique no botão para escolher uma nova.'],
      button: 'Redefinir palavra-passe',
    },
    en: {
      heading: 'Reset your password',
      paragraphs: ['We received a request to reset your password. Use the button above to choose a new one.'],
    },
    link: confirmUrl('recovery'),
  },
  {
    file: 'reauthentication',
    subject: 'O seu código de verificação: {{ .Token }}',
    preheader: 'Use este código para confirmar a sua identidade.',
    pt: {
      heading: 'Confirme a sua identidade',
      paragraphs: ['Introduza o código abaixo para continuar com esta operação. Não partilhe este código com ninguém.'],
    },
    en: {
      heading: 'Verify your identity',
      paragraphs: ['Enter the code above to continue. Never share this code with anyone.'],
    },
    code: true,
    link: null,
  },
]

function paragraph(html) {
  return `<p style="margin:0 0 12px 0;">${html}</p>`
}

function codeBox() {
  return `<tr>
              <td align="center" style="padding:0 32px 24px 32px;">
                <div style="display:inline-block;background-color:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;padding:14px 24px;font-family:'DM Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:600;letter-spacing:8px;color:${BRAND.navy};">{{ .Token }}</div>
              </td>
            </tr>`
}

function button(label, href) {
  return `<tr>
              <td align="center" style="padding:0 32px 24px 32px;">
                <a href="${href}" style="display:inline-block;background-color:${BRAND.navy};color:#ffffff;font-family:${BRAND.font};font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;">${label}</a>
              </td>
            </tr>`
}

function fallbackLink(href) {
  return `<tr>
              <td style="padding:0 32px 24px 32px;font-family:${BRAND.font};font-size:12px;line-height:1.6;color:${BRAND.muted};">
                Se o botão não funcionar, copie este endereço para o navegador · If the button doesn't work, copy this address into your browser:<br />
                <span style="word-break:break-all;color:${BRAND.accent};">${href}</span>
              </td>
            </tr>`
}

// Swap point: replace this function to restyle every email at once.
function layout(t) {
  const { pt, en } = t
  const parts = [
    `<tr>
              <td style="padding:16px 32px 0 32px;font-family:${BRAND.font};color:${BRAND.text};font-size:15px;line-height:1.6;">
                <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:${BRAND.navy};">${pt.heading}</h1>
                ${pt.paragraphs.map(paragraph).join('\n                ')}
              </td>
            </tr>`,
  ]
  if (t.code) parts.push(codeBox())
  if (t.link && pt.button) parts.push(button(pt.button, t.link), fallbackLink(t.link))
  parts.push(
    `<tr>
              <td style="padding:0 32px;"><hr style="border:0;border-top:1px solid ${BRAND.border};margin:0;" /></td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px 32px;font-family:${BRAND.font};font-size:13px;line-height:1.6;color:${BRAND.muted};">
                <strong style="color:${BRAND.text};">${en.heading}</strong><br />
                ${en.paragraphs.join('<br />\n                ')}
              </td>
            </tr>`,
  )

  return `<!DOCTYPE html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${pt.heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.bg};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${t.preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;border:1px solid ${BRAND.border};">
            <tr>
              <td align="center" bgcolor="${BRAND.navy}" style="background-color:${BRAND.navy};border-radius:16px 16px 0 0;padding:8px 32px;">
                <img src="${SITE}/email/sophi-logo.png" alt="Sophi Sports" width="150" style="display:block;height:auto;border:0;" />
              </td>
            </tr>
            ${parts.join('\n            ')}
          </table>
          <p style="margin:16px 0 0 0;font-family:${BRAND.font};font-size:11px;color:${BRAND.faint};">
            Sophi Sports — behind your team
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}

mkdirSync(DIST, { recursive: true })
const subjects = {}
for (const t of TEMPLATES) {
  writeFileSync(join(DIST, `${t.file}.html`), layout(t))
  subjects[t.file] = t.subject
}
writeFileSync(join(DIST, 'subjects.json'), JSON.stringify(subjects, null, 2) + '\n')
console.log(`Wrote ${TEMPLATES.length} templates to ${DIST}`)
