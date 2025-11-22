// === Moodle bulk downloader — sezioni + crawl sottocartelle folder ===
// Chrome/Edge desktop. Lancia dalla pagina corso (course/view.php?id=...).

(async () => {
  // ---------- utils ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const uniq = arr => [...new Set(arr)];
  const sanitize = (s) =>
    (s || 'Senza nome').replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 150);

  // ---------- 1) gesto utente: scegli cartella ----------
  const pickDir = () => new Promise((resolve, reject) => {
    const btn = document.createElement('button');
    btn.textContent = "📂 Scegli cartella Moodle";
    Object.assign(btn.style, {
      position: 'fixed', top: '10px', right: '10px',
      padding: '10px 16px', background: '#2563eb',
      color: 'white', border: '0', borderRadius: '8px',
      zIndex: 999999, cursor: 'pointer'
    });
    btn.onclick = async () => {
      try {
        const dir = await window.showDirectoryPicker();
        btn.remove();
        resolve(dir);
      } catch (e) {
        btn.remove(); reject(e);
      }
    };
    document.body.appendChild(btn);
    alert("Clicca il bottone blu per scegliere la cartella di destinazione.");
  });

  let rootDir;
  try { rootDir = await pickDir(); } catch (e) { console.error("Scelta cartella annullata:", e); return; }

  const ensureDir = async (parent, name) =>
    await parent.getDirectoryHandle(sanitize(name), { create: true });

  const saveBlob = async (dirHandle, filename, blob) => {
    const fh = await dirHandle.getFileHandle(sanitize(filename || 'download'), { create: true });
    const w = await fh.createWritable(); await w.write(blob); await w.close();
  };

  const filenameFromHeadersOrURL = (res, url) => {
    const cd = res.headers.get('content-disposition') || '';
    let m = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
    if (m) return decodeURIComponent(m[1].trim().replace(/^"|"$/g,''));
    m = cd.match(/filename=([^;]+)/i);
    if (m) return m[1].trim().replace(/^"|"$/g,'');
    try {
      const u = new URL(url);
      const last = decodeURIComponent(u.pathname.split('/').pop() || 'download');
      return last || 'download';
    } catch { return 'download'; }
  };

  // ---------- 2) estrai mappa: sezione → (viewUrl, title) ----------
  const tasks = []; // {section, viewUrl, title}
  document.querySelectorAll('li.section').forEach(sec => {
    const sName = sec.querySelector('h3.sectionname, .sectionname')?.textContent?.trim() || 'Senza sezione';
    sec.querySelectorAll(
      'li.activity.resource a[href*="/mod/resource/view.php?id="], li.activity.folder a[href*="/mod/folder/view.php?id="]'
    ).forEach(a => {
      const href = a.getAttribute('href');
      const title = a.querySelector('.instancename')?.textContent?.trim() || a.textContent.trim();
      tasks.push({
        section: sName,
        viewUrl: new URL(href, location.href).href,
        title: title.replace(/\s*(File|Folder)\s*$/i, '').trim()
      });
    });
  });
  if (!tasks.length) { alert("Nessuna risorsa/cartella trovata in questa pagina."); return; }

  // ---------- 3) parser generico file da una pagina view/folder ----------
  const collectPluginFilesFromDoc = (doc, baseUrl) => {
    const out = [];

    // a) meta refresh -> pluginfile
    const meta = doc.querySelector('meta[http-equiv="refresh" i]');
    if (meta?.content) {
      const m = meta.content.match(/url=(.+)$/i);
      if (m?.[1]) {
        const u = new URL(m[1].trim().replace(/^['"]|['"]$/g,''), baseUrl).href;
        if (/pluginfile\.php/i.test(u)) out.push(u);
      }
    }

    // b) classici: <a href>, <img src>, <video><source src>, <audio><source src>, <iframe src>
    doc.querySelectorAll('a[href*="pluginfile.php"], img[src*="pluginfile.php"], source[src*="pluginfile.php"], iframe[src*="pluginfile.php"]')
      .forEach(el => {
        const attr = el.getAttribute('href') || el.getAttribute('src');
        if (attr) out.push(new URL(attr, baseUrl).href);
      });

    // c) attributi data-… usati dal file picker/lista folder
    doc.querySelectorAll('[data-fileurl],[data-url]').forEach(el => {
      const v = el.getAttribute('data-fileurl') || el.getAttribute('data-url');
      if (v && /pluginfile\.php/.test(v)) out.push(new URL(v, baseUrl).href);
    });

    return uniq(out);
  };

  // ---------- 4) crawl ricorsivo di una folder (segue sottocartelle della stessa id=) ----------
  const sameFolderLink = (url, nextHref) => {
    try {
      const a = new URL(url);
      const b = new URL(nextHref, url);
      return a.origin === b.origin &&
             /\/mod\/folder\/view\.php$/i.test(b.pathname) &&
             a.searchParams.get('id') === b.searchParams.get('id');
    } catch { return false; }
  };

  const extractAllFilesFromView = async (viewUrl, maxDepth = 30) => {
    const files = new Set();
    const seenPages = new Set();
    const q = [viewUrl];

    while (q.length && seenPages.size < maxDepth) {
      const cur = q.shift();
      if (seenPages.has(cur)) continue;
      seenPages.add(cur);

      let res;
      try { res = await fetch(cur, { credentials: 'include' }); } catch { continue; }
      if (!res?.ok) continue;

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // raccogli tutti i file esposti in questa pagina
      collectPluginFilesFromDoc(doc, cur).forEach(u => files.add(u));

      // se è una folder: segui link alle sottocartelle/pagine (stessa id=)
      doc.querySelectorAll('a[href*="/mod/folder/view.php"]').forEach(a => {
        const href = a.getAttribute('href');
        const abs = new URL(href, cur).href;
        if (sameFolderLink(viewUrl, abs) && !seenPages.has(abs)) q.push(abs);
      });

      // a volte i link alle sottocartelle sono bottoni o elementi con data-url
      doc.querySelectorAll('[data-url*="/mod/folder/view.php"]').forEach(el => {
        const href = el.getAttribute('data-url');
        const abs = new URL(href, cur).href;
        if (sameFolderLink(viewUrl, abs) && !seenPages.has(abs)) q.push(abs);
      });

      await sleep(150);
    }

    return [...files];
  };

  // ---------- 5) download: Sezione/ (niente cartella per singola risorsa) ----------
  const PAGE_DELAY = 450, FILE_DELAY = 220;
  let total = 0, ok = 0, fail = 0;
  const seenFiles = new Set();

  for (let i = 0; i < tasks.length; i++) {
    const { section, viewUrl, title } = tasks[i];
    if (/\/mod\/(forum|quiz|assign)\//i.test(viewUrl)) continue;

    const secDir = await ensureDir(rootDir, section);

    // Estrai TUTTI i file (anche da sottocartelle della folder)
    const files = await extractAllFilesFromView(viewUrl);
    if (!files.length) { await sleep(PAGE_DELAY); continue; }

    console.log(`[${i+1}/${tasks.length}] ${section} — ${title}: ${files.length} file`);
    for (const fileUrl of files) {
      // evita duplicati
      if (seenFiles.has(fileUrl)) continue;
      seenFiles.add(fileUrl);
      total++;

      try {
        // togliamo ?embed=1 solo per il nome (il download va anche con embed=1)
        const urlForName = fileUrl.replace(/\?embed=1\b/i, '');
        const r = await fetch(fileUrl, { credentials: 'include' });
        if (!r.ok) { console.warn('FAIL', r.status, fileUrl); fail++; continue; }
        const blob = await r.blob();
        const original = filenameFromHeadersOrURL(r, urlForName);
        const finalName = `${sanitize(title)} - ${sanitize(original)}`;
        await saveBlob(secDir, finalName, blob);
        ok++;
      } catch (e) {
        console.error('Errore file', fileUrl, e); fail++;
      }
      await sleep(FILE_DELAY);
    }

    await sleep(PAGE_DELAY);
  }

  alert(`FATTO!\nScaricati OK: ${ok}\nFalliti: ${fail}\nTotali: ${total}\nControlla le cartelle per sezione.`);
})();
