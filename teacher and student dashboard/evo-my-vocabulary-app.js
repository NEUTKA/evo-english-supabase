(function () {
  if (window.__evoMyVocabularyAppInit) return;
  window.__evoMyVocabularyAppInit = true;

  const ROOT_SELECTOR = '[data-evo-my-vocab]';
  const APP_STYLE_ID = 'evo-my-vocabulary-app-styles';

  const apps = new WeakMap();

  function injectStyles() {
    if (document.getElementById(APP_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = APP_STYLE_ID;
    style.textContent = `
      [data-evo-my-vocab]{max-width:980px;margin:32px auto;padding:0 16px 40px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111213}
      [data-evo-my-vocab] *{box-sizing:border-box}
      .evc-wrap{display:grid;gap:18px}
      .evc-card{background:#fff;border:1px solid #dfe5ec;border-radius:16px;box-shadow:0 10px 24px rgba(0,0,0,.05);overflow:hidden}
      .evc-head{padding:18px 20px;border-bottom:1px solid #eef2f6;background:linear-gradient(180deg,#fff 0%,#f8fbff 100%)}
      .evc-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4EA9E7;font-weight:700;margin-bottom:6px}
      .evc-title{margin:0;font-size:28px;line-height:1.15}
      .evc-sub{margin-top:8px;color:#667085;font-size:15px;line-height:1.5}
      .evc-body{padding:18px 20px 20px}
      .evc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px;border:1px solid #e6ebf1;border-radius:14px;background:#fff}
      .evc-toolbar .grow{flex:1}
      .evc-input,.evc-select,.evc-textarea{width:100%;border:1px solid #d0d5dd;border-radius:12px;background:#fff;color:#111213;font:16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:12px 14px;outline:none}
      .evc-select,.evc-toolbar .evc-input{width:auto;min-width:220px}
      .evc-input:focus,.evc-select:focus,.evc-textarea:focus{border-color:#4EA9E7;box-shadow:0 0 0 3px rgba(78,169,231,.18)}
      .evc-textarea{min-height:92px;resize:vertical}
      .evc-btn{appearance:none;border:none;border-radius:12px;padding:12px 16px;font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer}
      .evc-btn-primary{background:#111213;color:#fff}
      .evc-btn-secondary{background:#f8fbff;color:#175cd3;border:1px solid #dbe7f3}
      .evc-btn-danger{background:#fff2f2;color:#b42318;border:1px solid #fecaca}
      .evc-btn:disabled{opacity:.62;cursor:not-allowed}
      .evc-switch{display:inline-flex;background:#F3F4F6;border:1px solid #d0d5dd;border-radius:10px;overflow:hidden}
      .evc-switch button{border:none;background:transparent;padding:9px 12px;cursor:pointer;font:700 14px system-ui;color:#667085}
      .evc-switch button.active{background:#fff;color:#111213}
      .evc-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
      .evc-pill{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid #dbe7f3;background:#f8fbff;color:#0f172a;font-size:14px}
      .evc-note{color:#667085;font-size:14px;line-height:1.5}
      .evc-empty{padding:24px;border:1px dashed #cfd8e3;border-radius:14px;background:#fbfdff;color:#667085;text-align:center}
      .evc-error{padding:16px 18px;border-radius:14px;background:#fff2f2;border:1px solid #fecaca;color:#b42318}
      .evc-success{padding:16px 18px;border-radius:14px;background:#ecfdf3;border:1px solid #b7ebc6;color:#027a48}
      .evc-stage{width:100%;height:280px;perspective:1000px;outline:none}
      .evc-inner{position:relative;width:100%;height:100%;transition:transform .45s;transform-style:preserve-3d}
      .evc-inner.is-flipped{transform:rotateY(180deg)}
      .evc-face{position:absolute;inset:0;background:linear-gradient(180deg,#fff,#f9fbff 60%);border:1px solid #e8ecf2;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;padding:24px;text-align:center;backface-visibility:hidden;box-shadow:0 12px 24px rgba(0,0,0,.06)}
      .evc-back{transform:rotateY(180deg)}
      .evc-under{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:12px;flex-wrap:wrap}
      .evc-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .evc-progress{height:8px;background:#eef2f7;border-radius:8px;overflow:hidden;margin-top:12px}
      .evc-bar{height:100%;width:0;background:#77BEF0;transition:width .25s}
      .evc-star{font-size:20px;cursor:pointer;user-select:none}
      .evc-table-wrap{overflow:auto;border:1px solid #e6ebf1;border-radius:14px;background:#fff}
      .evc-table{width:100%;border-collapse:separate;border-spacing:0}
      .evc-table th,.evc-table td{padding:10px 12px;border-bottom:1px solid #eef1f5;font:14px system-ui;vertical-align:middle;text-align:left}
      .evc-table th{background:#f8fafc;color:#475569;font-weight:700}
      .evc-table tr:last-child td{border-bottom:none}
      .evc-table input{width:100%;padding:8px 10px;border:1px solid #d0d5dd;border-radius:8px;font:14px system-ui}
      .evc-flash-inline{margin-top:12px}
      .evc-complete{padding:28px;border:1px solid #b7ebc6;border-radius:16px;background:#ecfdf3;color:#027a48;text-align:center;display:grid;gap:10px;justify-items:center}
      .evc-complete-title{font-size:24px;font-weight:800;color:#027a48}
      .evc-complete-text{font-size:15px;color:#065f46;line-height:1.5;max-width:520px}
      .evc-confetti{position:fixed;inset:0;pointer-events:none;z-index:10000;overflow:hidden}
      .evc-piece{position:absolute;width:8px;height:14px;opacity:.9;animation:evc-fall 1200ms ease-out forwards}
      @keyframes evc-fall{0%{transform:translate3d(var(--x,0),-20px,0) rotate(0deg)}100%{transform:translate3d(var(--x-end,0),calc(100vh + 30px),0) rotate(720deg)}}
      @media (max-width:760px){[data-evo-my-vocab]{padding:0 12px 28px}.evc-head,.evc-body{padding:16px}.evc-title{font-size:24px}.evc-toolbar{align-items:stretch}.evc-toolbar .grow{display:none}.evc-select,.evc-toolbar .evc-input,.evc-toolbar .evc-btn{width:100%}.evc-under{flex-direction:column;align-items:stretch}.evc-actions .evc-btn{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

  function when(cond, cb, tries = 100, delay = 150) {
    const t = setInterval(() => {
      if (cond()) { clearInterval(t); cb(); }
      else if (--tries <= 0) clearInterval(t);
    }, delay);
  }

  function normalizeWord(value) {
    return String(value || '').trim().toLowerCase();
  }

  function appTitle(root, profile) {
    return root.getAttribute('data-evo-my-vocab-title') || 'My Vocabulary';
  }

  function storageKey(userId, root) {
    const scope = root.getAttribute('data-evo-my-vocab-scope') || 'my-vocabulary';
    return `cards.activeModuleId:${userId}:${scope}`;
  }

  function createApp(root) {
    const state = {
      root,
      user: null,
      profile: null,
      modules: [],
      cards: [],
      activeModuleId: null,
      mode: 'learn',
      search: '',
      filterStarred: false,
      queue: [],
      baseIds: [],
      known: new Set(),
      idx: 0,
      flipped: false,
      flash: null,
      hasCelebrated: false,
      bridgeProvider: null
    };

    function setLoading() {
      root.innerHTML = `<div class="evc-wrap"><div class="evc-card"><div class="evc-head"><div class="evc-kicker">Vocabulary</div><h2 class="evc-title">Loading…</h2><div class="evc-sub">Preparing your vocabulary modules.</div></div></div></div>`;
    }

    function setError(message) {
      root.innerHTML = `<div class="evc-wrap"><div class="evc-card"><div class="evc-head"><div class="evc-kicker">Vocabulary</div><h2 class="evc-title">Something went wrong</h2></div><div class="evc-body"><div class="evc-error">${escapeHtml(message)}</div></div></div></div>`;
    }

    function showFlash(type, message) {
      state.flash = { type, message };
      render();
    }

    function getActiveModule() {
      return state.modules.find((m) => m.id === state.activeModuleId) || null;
    }

    async function ensureDefaultModule() {
      if (state.modules.length) return state.modules[0];
      const { data, error } = await window.supabase
        .from('modules')
        .insert({ user_id: state.user.id, name: 'My Words' })
        .select('id, user_id, name, created_at')
        .single();
      if (error) throw error;
      state.modules = [data];
      state.activeModuleId = data.id;
      try { localStorage.setItem(storageKey(state.user.id, root), data.id); } catch (_) {}
      return data;
    }

    async function fetchBase() {
      const { data: userData, error: userErr } = await window.supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData?.user;
      if (!user) throw new Error('User session not found.');
      state.user = user;

      const { data: profile } = await window.supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', user.id)
        .maybeSingle();
      state.profile = profile || { id: user.id, email: user.email || '', role: 'user' };

      const { data: modulesRows, error: modulesErr } = await window.supabase
        .from('modules')
        .select('id, user_id, name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (modulesErr) throw modulesErr;

      state.modules = modulesRows || [];
      if (!state.modules.length) await ensureDefaultModule();

      let saved = null;
      try { saved = localStorage.getItem(storageKey(user.id, root)); } catch (_) {}
      if (saved && state.modules.some((m) => m.id === saved)) state.activeModuleId = saved;
      if (!state.activeModuleId || !state.modules.some((m) => m.id === state.activeModuleId)) {
        state.activeModuleId = state.modules[0]?.id || null;
      }
      if (state.activeModuleId) {
        try { localStorage.setItem(storageKey(user.id, root), state.activeModuleId); } catch (_) {}
      }
    }

    async function fetchCards() {
      if (!state.activeModuleId) {
        state.cards = [];
        rebuildQueue(true);
        return;
      }
      const { data, error } = await window.supabase
        .from('cards')
        .select('id, user_id, module_id, word, translation, starred, created_at')
        .eq('user_id', state.user.id)
        .eq('module_id', state.activeModuleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      state.cards = data || [];
      rebuildQueue(true);
    }

    async function reloadAll() {
      await fetchBase();
      await fetchCards();
    }

    function filteredCards() {
      const q = state.search.trim().toLowerCase();
      return state.cards.filter((c) => {
        if (state.filterStarred && !c.starred) return false;
        if (!q) return true;
        return String(c.word || '').toLowerCase().includes(q) || String(c.translation || '').toLowerCase().includes(q);
      });
    }

    function rebuildQueue(reset = false) {
      const filtered = filteredCards();
      state.baseIds = filtered.map((c) => c.id);
      state.queue = filtered.slice();
      if (reset) {
        state.known = new Set();
        state.idx = 0;
        state.flipped = false;
        state.hasCelebrated = false;
      }
      if (state.idx >= state.queue.length) state.idx = Math.max(0, state.queue.length - 1);
    }

    function shuffleQueue() {
      rebuildQueue(true);
      for (let i = state.queue.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
      }
      state.idx = 0;
      state.flipped = false;
      state.hasCelebrated = false;
    }

    function celebrate() {
      if (state.hasCelebrated) return;
      state.hasCelebrated = true;

      const toast = document.createElement('div');
      toast.textContent = 'Great! All cards are learned 🎉';
      toast.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);background:#111;color:#fff;padding:12px 16px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:10001;opacity:0;transition:.25s opacity;font-family:system-ui;font-size:16px;text-align:center';
      document.body.appendChild(toast);
      requestAnimationFrame(() => { toast.style.opacity = '1'; });
      window.setTimeout(() => {
        toast.style.opacity = '0';
        window.setTimeout(() => toast.remove(), 300);
      }, 1600);

      const wrap = document.createElement('div');
      wrap.className = 'evc-confetti';
      document.body.appendChild(wrap);
      const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#fb7185'];
      for (let i = 0; i < 90; i += 1) {
        const piece = document.createElement('div');
        piece.className = 'evc-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.background = colors[i % colors.length];
        piece.style.setProperty('--x', `${(Math.random() - 0.5) * 120}px`);
        piece.style.setProperty('--x-end', `${(Math.random() - 0.5) * 220}px`);
        piece.style.animationDelay = `${Math.random() * 250}ms`;
        wrap.appendChild(piece);
      }
      window.setTimeout(() => wrap.remove(), 1800);
    }

    function renderContentOnly() {
      const content = root.querySelector('[data-evc-content]');
      if (!content) return render();
      content.innerHTML = state.mode === 'learn' ? renderLearnArea() : renderManageArea();
      bindEvents();
    }

    function markKnownAndAdvance() {
      const c = state.queue[state.idx];
      if (c) state.known.add(c.id);
      state.flipped = false;

      if (state.baseIds.length && state.known.size >= state.baseIds.length) {
        celebrate();
        return renderContentOnly();
      }

      if (state.idx < state.queue.length - 1) {
        state.idx += 1;
      }

      renderContentOnly();
    }

    async function saveWordToActiveModule(payload) {
      const word = String(payload?.word || '').trim();
      const translation = String(payload?.translation || '').trim();
      if (!word) throw new Error('No word selected.');
      if (!state.user) await fetchBase();
      if (!state.activeModuleId) await ensureDefaultModule();

      const { error } = await window.supabase.from('cards').upsert({
        user_id: state.user.id,
        module_id: state.activeModuleId,
        word,
        translation
      }, { onConflict: 'user_id,module_id,word_norm' });
      if (error) throw error;

      await fetchCards();
      state.mode = 'manage';
      render();
      return { module_id: state.activeModuleId };
    }

    function registerBridge() {
      const provider = {
        name: 'evo-my-vocabulary',
        async saveWord(payload) {
          return saveWordToActiveModule(payload);
        },
        async listModules() {
          if (!state.user) await fetchBase();
          return state.modules.map((m) => ({ id: m.id, title: m.name || 'Module' }));
        },
        getActiveModuleId() {
          return state.activeModuleId;
        }
      };
      state.bridgeProvider = provider;
      if (window.EvoCardsBridge?.register) {
        window.EvoCardsBridge.register(provider);
      }
    }

    async function createModule() {
      const name = window.prompt('Module name', 'New Module');
      if (!name) return;
      const { data, error } = await window.supabase
        .from('modules')
        .insert({ user_id: state.user.id, name: name.trim() })
        .select('id, user_id, name, created_at')
        .single();
      if (error) return showFlash('error', error.message);
      state.modules.push(data);
      state.activeModuleId = data.id;
      try { localStorage.setItem(storageKey(state.user.id, root), data.id); } catch (_) {}
      await fetchCards();
      render();
    }

    async function renameModule() {
      const mod = getActiveModule();
      if (!mod) return;
      const name = window.prompt('Rename module', mod.name || 'Module');
      if (!name) return;
      const { error } = await window.supabase
        .from('modules')
        .update({ name: name.trim() })
        .eq('id', mod.id)
        .eq('user_id', state.user.id);
      if (error) return showFlash('error', error.message);
      await reloadAll();
      render();
    }

    async function deleteModule() {
      const mod = getActiveModule();
      if (!mod) return;
      if (!window.confirm(`Delete module "${mod.name}"? Cards inside this module will also be removed if your database cascade is enabled.`)) return;
      const { error } = await window.supabase
        .from('modules')
        .delete()
        .eq('id', mod.id)
        .eq('user_id', state.user.id);
      if (error) return showFlash('error', error.message);
      state.activeModuleId = null;
      await reloadAll();
      render();
    }

    async function createCardFromForm() {
      const word = root.querySelector('[data-evc-new-word]')?.value.trim() || '';
      const translation = root.querySelector('[data-evc-new-translation]')?.value.trim() || '';
      if (!word || !translation) return showFlash('error', 'Add word and translation.');
      try {
        await saveWordToActiveModule({ word, translation });
        showFlash('success', 'Card added.');
      } catch (err) {
        showFlash('error', err?.message || 'Could not add card.');
      }
    }

    async function updateCard(row) {
      const id = row.getAttribute('data-card-id');
      const word = row.querySelector('[data-field="word"]')?.value.trim() || '';
      const translation = row.querySelector('[data-field="translation"]')?.value.trim() || '';
      if (!id || !word || !translation) return;
      const { error } = await window.supabase
        .from('cards')
        .update({ word, translation })
        .eq('id', id)
        .eq('user_id', state.user.id);
      if (error) return showFlash('error', error.message);
      await fetchCards();
      render();
    }

    async function deleteCard(id) {
      if (!id) return;
      if (!window.confirm('Delete this card?')) return;
      const { error } = await window.supabase
        .from('cards')
        .delete()
        .eq('id', id)
        .eq('user_id', state.user.id);
      if (error) return showFlash('error', error.message);
      await fetchCards();
      render();
    }

    async function toggleStar(id) {
      const card = state.cards.find((c) => c.id === id);
      if (!card) return;
      const { error } = await window.supabase
        .from('cards')
        .update({ starred: !card.starred })
        .eq('id', id)
        .eq('user_id', state.user.id);
      if (error) return showFlash('error', error.message);
      card.starred = !card.starred;
      rebuildQueue(false);
      render();
    }

    function renderLearnArea() {
      const c = state.queue[state.idx];
      const pct = state.baseIds.length ? Math.round((state.known.size / state.baseIds.length) * 100) : 0;
      if (state.baseIds.length && state.known.size >= state.baseIds.length) {
        return `
          <div class="evc-complete">
            <div class="evc-complete-title">Great! All cards are learned 🎉</div>
            <div class="evc-complete-text">You marked every card in this module as known. You can shuffle and practice again, switch to Manage, or add more cards.</div>
            <button class="evc-btn evc-btn-primary" type="button" data-evc-action="restart">Practice again</button>
          </div>
          <div class="evc-progress"><div class="evc-bar" style="width:100%"></div></div>
        `;
      }
      if (!c) {
        return `<div class="evc-empty">No cards match the current filter.</div><div class="evc-progress"><div class="evc-bar" style="width:0%"></div></div>`;
      }
      return `
        <div class="evc-stage" tabindex="0">
          <div class="evc-inner ${state.flipped ? 'is-flipped' : ''}">
            <div class="evc-face evc-front">${escapeHtml(c.word || '')}</div>
            <div class="evc-face evc-back">${escapeHtml(c.translation || '')}</div>
          </div>
        </div>
        <div class="evc-under">
          <div class="evc-actions">
            <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="prev">←</button>
            <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="flip">Flip</button>
            <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="next">→</button>
            <span class="evc-note">${Math.min(state.idx + 1, state.queue.length)} / ${state.queue.length}</span>
          </div>
          <div class="evc-actions">
            <span class="evc-star" data-evc-action="star" data-card-id="${escapeHtml(c.id)}">${c.starred ? '★' : '☆'}</span>
            <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="dont-know">Don't know</button>
            <button class="evc-btn evc-btn-primary" type="button" data-evc-action="know">I know</button>
          </div>
        </div>
        <div class="evc-progress"><div class="evc-bar" style="width:${pct}%"></div></div>
      `;
    }

    function renderManageArea() {
      const rows = filteredCards().map((c) => `
        <tr data-card-id="${escapeHtml(c.id)}">
          <td><input data-field="word" value="${escapeHtml(c.word || '')}" /></td>
          <td><input data-field="translation" value="${escapeHtml(c.translation || '')}" /></td>
          <td><button class="evc-btn evc-btn-secondary" type="button" data-evc-action="star" data-card-id="${escapeHtml(c.id)}">${c.starred ? '★' : '☆'}</button></td>
          <td>
            <div class="evc-actions">
              <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="save-row">Save</button>
              <button class="evc-btn evc-btn-danger" type="button" data-evc-action="delete-row">Delete</button>
            </div>
          </td>
        </tr>
      `).join('');

      return `
        <div class="evc-card" style="box-shadow:none;">
          <div class="evc-body">
            <div class="evc-toolbar">
              <input class="evc-input" data-evc-new-word placeholder="Word" />
              <input class="evc-input" data-evc-new-translation placeholder="Translation" />
              <button class="evc-btn evc-btn-primary" type="button" data-evc-action="add-card">Add card</button>
            </div>
          </div>
        </div>
        <div class="evc-table-wrap" style="margin-top:14px;">
          <table class="evc-table">
            <thead><tr><th style="width:34%">Word</th><th style="width:34%">Translation</th><th style="width:8%">★</th><th style="width:24%">Actions</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="4"><div class="evc-empty">No cards yet. Add your first word manually or use the translator popup.</div></td></tr>`}</tbody>
          </table>
        </div>
      `;
    }

    function render() {
      const title = appTitle(root, state.profile);
      const role = state.profile?.role || 'user';
      const activeModule = getActiveModule();
      const flash = state.flash ? `<div class="${state.flash.type === 'error' ? 'evc-error' : 'evc-success'} evc-flash-inline">${escapeHtml(state.flash.message)}</div>` : '';
      state.flash = null;

      root.innerHTML = `
        <div class="evc-wrap">
          ${flash}
          <div class="evc-card">
            <div class="evc-head">
              <div class="evc-kicker">Vocabulary</div>
              <h2 class="evc-title">${escapeHtml(title)}</h2>
              <div class="evc-meta">
                <div class="evc-pill">Role: ${escapeHtml(role)}</div>
                <div class="evc-pill">${state.modules.length} module${state.modules.length === 1 ? '' : 's'}</div>
                <div class="evc-pill">${state.cards.length} card${state.cards.length === 1 ? '' : 's'}</div>
              </div>
            </div>
            <div class="evc-body">
              <div class="evc-toolbar">
                <select class="evc-select" data-evc-module>
                  ${state.modules.map((m) => `<option value="${escapeHtml(m.id)}" ${m.id === state.activeModuleId ? 'selected' : ''}>${escapeHtml(m.name || 'Module')}</option>`).join('')}
                </select>
                <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="new-module">Create module</button>
                <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="rename-module" ${activeModule ? '' : 'disabled'}>Rename</button>
                <button class="evc-btn evc-btn-danger" type="button" data-evc-action="delete-module" ${activeModule ? '' : 'disabled'}>Delete</button>
                <div class="grow"></div>
                <div class="evc-switch">
                  <button type="button" data-evc-mode="learn" class="${state.mode === 'learn' ? 'active' : ''}">Learn</button>
                  <button type="button" data-evc-mode="manage" class="${state.mode === 'manage' ? 'active' : ''}">Manage</button>
                </div>
                <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="shuffle">Shuffle</button>
                <button class="evc-btn evc-btn-secondary" type="button" data-evc-action="filter-starred">Starred: ${state.filterStarred ? 'on' : 'off'}</button>
                <input class="evc-input" data-evc-search placeholder="Search…" value="${escapeHtml(state.search)}" />
              </div>

              <div data-evc-content style="margin-top:14px;">
                ${state.mode === 'learn' ? renderLearnArea() : renderManageArea()}
              </div>
            </div>
          </div>
        </div>
      `;
      bindEvents();
    }

    function bindEvents() {
      const moduleSel = root.querySelector('[data-evc-module]');
      if (moduleSel) {
        moduleSel.onchange = async (e) => {
          state.activeModuleId = e.target.value || null;
          try { localStorage.setItem(storageKey(state.user.id, root), state.activeModuleId || ''); } catch (_) {}
          await fetchCards();
          render();
        };
      }

      const search = root.querySelector('[data-evc-search]');
      if (search) {
        search.oninput = (e) => {
          state.search = e.target.value || '';
          rebuildQueue(true);
          renderContentOnly();
        };
      }

      root.querySelectorAll('[data-evc-mode]').forEach((btn) => {
        btn.onclick = () => {
          state.mode = btn.getAttribute('data-evc-mode') || 'learn';
          render();
        };
      });

      root.querySelectorAll('[data-evc-action]').forEach((el) => {
        el.onclick = async () => {
          const action = el.getAttribute('data-evc-action');
          try {
            if (action === 'new-module') return createModule();
            if (action === 'rename-module') return renameModule();
            if (action === 'delete-module') return deleteModule();
            if (action === 'add-card') return createCardFromForm();
            if (action === 'filter-starred') { state.filterStarred = !state.filterStarred; rebuildQueue(true); return render(); }
            if (action === 'shuffle') { shuffleQueue(); return renderContentOnly(); }
            if (action === 'restart') { rebuildQueue(true); return renderContentOnly(); }
            if (action === 'flip') { state.flipped = !state.flipped; return renderContentOnly(); }
            if (action === 'prev') { state.idx = Math.max(0, state.idx - 1); state.flipped = false; return renderContentOnly(); }
            if (action === 'next') { state.idx = Math.min(state.queue.length - 1, state.idx + 1); state.flipped = false; return renderContentOnly(); }
            if (action === 'know') { return markKnownAndAdvance(); }
            if (action === 'dont-know') { const c = state.queue[state.idx]; if (c) state.queue.push(c); if (state.idx < state.queue.length - 1) state.idx += 1; state.flipped = false; return renderContentOnly(); }
            if (action === 'star') return toggleStar(el.getAttribute('data-card-id'));
            if (action === 'save-row') return updateCard(el.closest('tr'));
            if (action === 'delete-row') return deleteCard(el.closest('tr')?.getAttribute('data-card-id'));
          } catch (err) {
            showFlash('error', err?.message || 'Action failed.');
          }
        };
      });
    }

    async function start() {
      injectStyles();
      setLoading();
      try {
        await reloadAll();
        registerBridge();
        render();
      } catch (err) {
        console.error('[evo-my-vocabulary]', err);
        setError(err?.message || 'Could not load My Vocabulary.');
      }
    }

    return { start, state };
  }

  function initAll() {
    document.querySelectorAll(ROOT_SELECTOR).forEach((root) => {
      if (apps.has(root)) return;
      const app = createApp(root);
      apps.set(root, app);
      app.start();
    });
  }

  function boot() {
    const ready = () => !!window.supabase && document.querySelector(ROOT_SELECTOR);
    if (ready()) return initAll();
    when(ready, initAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
