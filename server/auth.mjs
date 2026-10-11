// Login do painel: sessão em cookie assinado (HMAC), sem banco de sessões.
//   admin    -> ADMIN_USER / ADMIN_PASSWORD (variáveis de ambiente), vê tudo
//   parceiro -> usuário/senha cadastrados pelo admin, vê só os próprios cadastros
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { verifyPassword } from './store.mjs';

const COOKIE = 'eletrodara_sessao';
const SESSION_DAYS = 7;
const LOGIN_MAX_FAILURES = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function createAuth({ dataDir, adminUser, adminPassword, store }) {
  const secret = process.env.SESSION_SECRET || (await loadOrCreateSecret(dataDir));
  const loginFailures = new Map(); // ip -> timestamps de erros

  const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  function issueCookie(session) {
    const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + SESSION_DAYS * 86400000 })).toString('base64url');
    return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
  }

  const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

  // Retorna { role: 'admin' } ou { role: 'partner', partner } ou null.
  function currentUser(req) {
    const raw = (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE}=`));
    if (!raw) return null;
    const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
    if (!payload || !sig) return null;
    const expected = sign(payload);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    let session;
    try {
      session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    if (!session.exp || session.exp < Date.now()) return null;
    if (session.role === 'admin') return adminPassword ? { role: 'admin', name: 'Administrador' } : null;
    if (session.role === 'partner') {
      const partner = store.partners.get(session.partnerId);
      // Senha trocada ou parceiro desativado derrubam sessões antigas.
      if (!partner || !partner.active || partner.passwordHash.slice(0, 8) !== session.pw) return null;
      return { role: 'partner', name: partner.name, partner };
    }
    return null;
  }

  function loginBlocked(ip) {
    const now = Date.now();
    const recent = (loginFailures.get(ip) || []).filter((t) => now - t < LOGIN_WINDOW_MS);
    loginFailures.set(ip, recent);
    return recent.length >= LOGIN_MAX_FAILURES;
  }

  // Valida usuário/senha. Retorna o cookie de sessão ou null.
  function login(ip, username, password) {
    const user = String(username || '').trim().toLowerCase();
    const pass = String(password || '');
    let session = null;

    if (adminPassword && safeEqual(user, adminUser.toLowerCase()) && safeEqual(pass, adminPassword)) {
      session = { role: 'admin' };
    } else {
      const partner = store.findPartnerByUsername(user);
      if (partner?.active && verifyPassword(pass, partner.passwordHash)) {
        session = { role: 'partner', partnerId: partner.id, pw: partner.passwordHash.slice(0, 8) };
      }
    }

    if (!session) {
      loginFailures.set(ip, [...(loginFailures.get(ip) || []), Date.now()]);
      return null;
    }
    loginFailures.delete(ip);
    return issueCookie(session);
  }

  return { currentUser, login, loginBlocked, clearCookie };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

async function loadOrCreateSecret(dataDir) {
  const file = path.join(dataDir, 'session-secret');
  try {
    return (await fs.readFile(file, 'utf8')).trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(file, secret, { mode: 0o600 });
    return secret;
  }
}
