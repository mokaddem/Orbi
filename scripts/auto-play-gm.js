(() => {
  if (window.__gmRunning) { window.__gmStop?.(); }

  // Oceania seed: localized country name (en/fr/de) -> iso2. In a country-to-flag
  // question the prompt is a localized name, so we need name->iso to know which flag
  // to click. Beyond this seed the map self-extends by harvesting names from the
  // challenge search list (see harvestNames), so any continent's flags run works
  // once one flag-to-country question has listed that continent's options.
  const RAW = {"Australia":"AU","Australie":"AU","Australien":"AU","Fiji":"FJ","Fidji":"FJ","Fidschi":"FJ","Kiribati":"KI","Marshall Islands":"MH","Iles Marshall":"MH","Marshallinseln":"MH","Micronesia":"FM","Micronesie":"FM","Mikronesien":"FM","Nauru":"NR","New Zealand":"NZ","Nouvelle-Zelande":"NZ","Neuseeland":"NZ","Palau":"PW","Palaos (Palau)":"PW","Papua New Guinea":"PG","Papouasie-Nouvelle-Guinee":"PG","Papua-Neuguinea":"PG","Samoa":"WS","Solomon Islands":"SB","Iles Salomon":"SB","Salomonen":"SB","Tonga":"TO","Tuvalu":"TV","Vanuatu":"VU"};
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const NAME2ISO = {};
  for (const k in RAW) NAME2ISO[norm(k)] = RAW[k];

  const STEP_MS = 1200;   // pause on each question before answering - raise to inspect the transition, lower to blast through
  const POLL_MS = 150;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.__gmRunning = true;
  window.__gmStop = () => { window.__gmRunning = false; console.log('stopped autoplay'); };

  // iso2 from an <img class="flag"> src: .../nz.svg or .../nz-<hash>.svg (the dev path).
  // In a prod build small flags inline as data: URIs with no filename - then this
  // returns null and a flag-to-country prompt can't be read, so run this against the
  // dev server (the intended target).
  const flagIso = img => {
    const base = (img?.getAttribute('src') || '').split('?')[0].split('/').pop() || '';
    const code = base.split('.')[0].split('-')[0];
    return code.length === 2 ? code.toUpperCase() : null;
  };

  // Learn name->iso from the challenge search list. In a flag-to-country question each
  // option is <button class="result" data-id="ISO">Localized name</button>, so one
  // such question teaches us the whole continent - which then lets the country-to-flag
  // questions resolve even outside the Oceania seed. Flag options carry no text, so
  // they're skipped here.
  const harvestNames = () => {
    for (const b of document.querySelectorAll('button.choice[data-id], button.result[data-id]')) {
      const id = (b.getAttribute('data-id') || '').toUpperCase();
      const name = norm(b.textContent);
      if (id.length === 2 && name) NAME2ISO[name] = id;
    }
  };

  const currentAnswer = () => {
    const pf = document.querySelector('.prompt-flag img.flag');   // flag-to-country -> read the prompt flag
    if (pf) return flagIso(pf);
    const nm = document.querySelector('.prompt-name');            // country-to-flag -> map the prompt name
    if (nm) return NAME2ISO[norm(nm.textContent)] || null;
    return null;
  };

  // Options are button.choice[data-id] (flag grid) or button.result[data-id] (name
  // search list) - both are buttons carrying an uppercase iso2. Scoping to those two
  // classes keeps us from ever clicking a menu/nav button that also has a data-id.
  const optionFor = iso => iso && document.querySelector(
    `button.choice[data-id="${iso}"]:not([disabled]), button.result[data-id="${iso}"]:not([disabled])`,
  );
  const anyPlayable = () => document.querySelector(
    'button.choice[data-id]:not([disabled]), button.result[data-id]:not([disabled])',
  );
  const waitUntil = async (pred, timeout = 15000) => {
    const t0 = performance.now();
    while (window.__gmRunning && !pred()) {
      if (performance.now() - t0 > timeout) return false;
      await sleep(POLL_MS);
    }
    return window.__gmRunning && !!pred();
  };

  (async () => {
    console.log('GM autoplay running - call window.__gmStop() to stop.');
    let n = 0;
    while (window.__gmRunning) {
      // Wait for a fresh, answerable question. If none appears, the run is over
      // (board cleared, or the single life was lost).
      const ready = await waitUntil(() => anyPlayable());
      if (!window.__gmRunning) break;
      if (!ready) { console.log(`run over - answered ${n}.`); break; }

      await sleep(STEP_MS);                 // let you watch the fresh question (and any ghost of the last one)
      if (!window.__gmRunning) break;

      harvestNames();
      const iso = currentAnswer();
      const btn = optionFor(iso);
      if (!btn) {
        console.warn('cannot resolve this answer - stopping so a wrong click does not end the run.',
          { iso, prompt: document.querySelector('.prompt')?.textContent?.trim() });
        break;
      }
      btn.click(); n++;
      console.log(`answered ${iso} (#${n})`);

      await waitUntil(() => !optionFor(iso));   // this question locked in; then loop waits for the next
    }
    window.__gmRunning = false;
  })();
})();
