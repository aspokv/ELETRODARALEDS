// Armazenamento em arquivos JSON dentro de DATA_DIR (volume persistente no Coolify).
//   leads/<id>.json      cadastros
//   files/<id>.<ext>     contas de luz
//   partners/<id>.json   parceiros
//   settings.json        configurações (tarifa média etc.)
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const STATUSES = [
  { id: 'novo', label: 'Novo' },
  { id: 'atendimento', label: 'Em atendimento' },
  { id: 'analisada', label: 'Conta analisada' },
  { id: 'ativado', label: 'Ativado' },
  { id: 'perdido', label: 'Perdido' },
];
export const STATUS_IDS = STATUSES.map((s) => s.id);

const DEFAULT_SETTINGS = { tariffPerKwh: 0.95 };

export function createStore(dataDir) {
  const dirs = {
    leads: path.join(dataDir, 'leads'),
    files: path.join(dataDir, 'files'),
    partners: path.join(dataDir, 'partners'),
  };
  const settingsPath = path.join(dataDir, 'settings.json');

  /** @type {Map<string, any>} */
  const leads = new Map();
  /** @type {Map<string, any>} */
  const partners = new Map();
  let settings = { ...DEFAULT_SETTINGS };

  async function loadDir(dir, map) {
    for (const name of await fs.readdir(dir)) {
      if (!name.endsWith('.json')) continue;
      try {
        const item = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
        map.set(item.id, item);
      } catch (err) {
        console.error('Arquivo ilegível:', name, err.message);
      }
    }
  }

  async function load() {
    for (const dir of Object.values(dirs)) await fs.mkdir(dir, { recursive: true });
    await loadDir(dirs.leads, leads);
    await loadDir(dirs.partners, partners);
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(await fs.readFile(settingsPath, 'utf8')) };
    } catch {
      /* primeira execução */
    }
    for (const lead of leads.values()) migrateLead(lead);
    console.log(`${leads.size} cadastros e ${partners.size} parceiros carregados de ${dataDir}`);
  }

  // Cadastros antigos (antes do painel completo) não tinham status/kWh/parceiro.
  function migrateLead(lead) {
    lead.status ??= 'novo';
    lead.history ??= [];
    lead.notes ??= '';
    lead.kwhReal ??= null;
    if (lead.kwhEstimated == null && lead.billValue) lead.kwhEstimated = Math.round(lead.billValue / settings.tariffPerKwh);
    if (lead.partnerId === undefined) {
      const partner = lead.seller ? findPartnerBySlug(lead.seller) : null;
      lead.partnerId = partner?.id ?? null;
    }
  }

  const writeJson = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2));

  // ---- Leads -------------------------------------------------------------

  const saveLead = (lead) => writeJson(path.join(dirs.leads, `${lead.id}.json`), lead);

  async function addLead(lead, fileBuffer, fileExt) {
    if (fileBuffer) {
      const stored = `${lead.id}${fileExt}`;
      await fs.writeFile(path.join(dirs.files, stored), fileBuffer);
      lead.file = { ...lead.file, stored, size: fileBuffer.length };
    }
    leads.set(lead.id, lead);
    await saveLead(lead);
    return lead;
  }

  async function updateLead(id, changes, by) {
    const lead = leads.get(id);
    if (!lead) return null;
    if (changes.status && changes.status !== lead.status && STATUS_IDS.includes(changes.status)) {
      lead.history.push({ status: changes.status, from: lead.status, at: new Date().toISOString(), by });
      lead.status = changes.status;
    }
    if ('kwhReal' in changes) lead.kwhReal = changes.kwhReal;
    if ('notes' in changes) lead.notes = changes.notes;
    if ('partnerId' in changes) lead.partnerId = changes.partnerId;
    lead.updatedAt = new Date().toISOString();
    await saveLead(lead);
    return lead;
  }

  const filePath = (lead) => path.join(dirs.files, lead.file.stored);

  async function removeLeadFile(lead) {
    if (!lead.file || lead.file.deletedAt) return;
    await fs.rm(filePath(lead), { force: true });
    lead.file = { ...lead.file, deletedAt: new Date().toISOString() };
    await saveLead(lead);
  }

  async function deleteLead(id) {
    const lead = leads.get(id);
    if (!lead) return false;
    if (lead.file && !lead.file.deletedAt) await fs.rm(filePath(lead), { force: true });
    await fs.rm(path.join(dirs.leads, `${id}.json`), { force: true });
    leads.delete(id);
    return true;
  }

  const findLeadByFileToken = (token) => [...leads.values()].find((l) => l.file?.token === token) || null;

  async function cleanupOldFiles(retentionDays) {
    const limit = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    for (const lead of leads.values()) {
      if (lead.file && !lead.file.deletedAt && new Date(lead.createdAt).getTime() < limit) {
        await removeLeadFile(lead);
        console.log('Conta expirada removida:', lead.id);
      }
    }
  }

  // ---- Parceiros ---------------------------------------------------------

  const savePartner = (p) => writeJson(path.join(dirs.partners, `${p.id}.json`), p);

  const slugify = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

  function uniqueSlug(base, exceptId) {
    const root = slugify(base) || 'parceiro';
    let slug = root;
    for (let i = 2; [...partners.values()].some((p) => p.slug === slug && p.id !== exceptId); i++) slug = `${root}-${i}`;
    return slug;
  }

  const findPartnerBySlug = (slug) => [...partners.values()].find((p) => p.slug === String(slug).toLowerCase()) || null;
  const findPartnerByUsername = (u) => [...partners.values()].find((p) => p.username === String(u).toLowerCase()) || null;

  async function addPartner({ name, whatsapp, username, password, slug }) {
    const partner = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      name,
      whatsapp,
      slug: uniqueSlug(slug || name),
      username: username.toLowerCase(),
      passwordHash: hashPassword(password),
      active: true,
    };
    partners.set(partner.id, partner);
    await savePartner(partner);
    return partner;
  }

  async function updatePartner(id, changes) {
    const partner = partners.get(id);
    if (!partner) return null;
    if (changes.name) partner.name = changes.name;
    if (changes.whatsapp) partner.whatsapp = changes.whatsapp;
    if (changes.password) partner.passwordHash = hashPassword(changes.password);
    if ('active' in changes) partner.active = changes.active;
    await savePartner(partner);
    return partner;
  }

  async function deletePartner(id) {
    if (!partners.delete(id)) return false;
    await fs.rm(path.join(dirs.partners, `${id}.json`), { force: true });
    // Os cadastros continuam existindo; só perdem o vínculo com o parceiro removido.
    for (const lead of leads.values()) if (lead.partnerId === id) await updateLead(lead.id, { partnerId: null }, 'sistema');
    return true;
  }

  // ---- Configurações -----------------------------------------------------

  async function updateSettings(changes) {
    settings = { ...settings, ...changes };
    await writeJson(settingsPath, settings);
    return settings;
  }

  return {
    load,
    leads,
    partners,
    get settings() {
      return settings;
    },
    addLead,
    updateLead,
    deleteLead,
    removeLeadFile,
    filePath,
    findLeadByFileToken,
    cleanupOldFiles,
    addPartner,
    updatePartner,
    deletePartner,
    findPartnerBySlug,
    findPartnerByUsername,
    updateSettings,
  };
}

// ---- Senhas (scrypt com salt) ---------------------------------------------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const given = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
