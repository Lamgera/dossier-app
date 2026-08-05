// src/scripts/index.js
const cover = document.querySelector('.folder__cover');
const openBtn = document.querySelector('.cover-button');

openBtn.addEventListener('click', () => {
  cover.classList.toggle('animated');
});


/* ================= Система закладок ================= */
const Pages = (() => {
  const pagesList     = document.getElementById('pages-list');
  const bookmarksList = document.getElementById('bookmarks-list');

  // ключи, под которыми прогресс лежит в localStorage
  const UNLOCKED_KEY = 'dossier-unlocked'; // массив id открытых досье
  const ACTIVE_KEY   = 'dossier-active';   // id последнего просмотренного листа

  let topZ = 1; // счётчик «верха» стопки

  const getPage     = (id) => pagesList.querySelector(`.page[data-page-id="${id}"]`);
  const getBookmark = (id) => bookmarksList.querySelector(`.bookmark[data-for-page="${id}"]`);

  /* --- Работа с localStorage (с защитой от недоступного хранилища) --- */

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback; // хранилище заблокировано или данные повреждены
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // например, приватный режим — просто работаем без сохранения
    }
  }

  /* --- Закладки --- */

  function createBookmark(pageEl) {
    const li = document.createElement('li');
    li.className = 'bookmark';
    li.dataset.forPage = pageEl.dataset.pageId;
    if (pageEl.classList.contains('page--locked')) li.classList.add('bookmark--locked');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bookmark__btn';
    btn.textContent = pageEl.dataset.tab || 'Без имени';
    btn.addEventListener('click', () => openPage(pageEl.dataset.pageId));

    li.append(btn);
    bookmarksList.append(li);
    return li;
  }

  /* --- Листы --- */

  function openPage(id) {
    const page = getPage(id);
    if (!page || page.classList.contains('page--locked')) return;

    page.style.zIndex = ++topZ;

    bookmarksList.querySelectorAll('.bookmark--active').forEach((b) => {
      b.classList.remove('bookmark--active');
      b.firstElementChild.removeAttribute('aria-current');
      b.style.zIndex = ''; // возврат на базовый z-index: 1 из CSS
    });

    const bookmark = getBookmark(id);
    if (bookmark) {
      bookmark.classList.add('bookmark--active');
      bookmark.firstElementChild.setAttribute('aria-current', 'page');
      bookmark.style.zIndex = topZ + 1; // активная закладка — часть листа
      bookmark.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    page.classList.remove('page--pop');
    void page.offsetWidth;
    page.classList.add('page--pop');

    // запоминаем, какой лист был открыт последним
    saveJSON(ACTIVE_KEY, id);
  }

  pagesList.addEventListener('animationend', (e) => {
    if (e.animationName === 'page-pop') e.target.classList.remove('page--pop');
  });

  /* --- Разблокировка скрытых досье + сохранение прогресса --- */

  function unlockPage(id, open = true) {
    const page = getPage(id);
    if (!page) return;

    const wasLocked = page.classList.contains('page--locked');
    page.classList.remove('page--locked');
    getBookmark(id)?.classList.remove('bookmark--locked');

    // в хранилище id попадает только при первой разблокировке
    if (wasLocked) {
      const saved = loadJSON(UNLOCKED_KEY, []);
      if (!saved.includes(id)) {
        saved.push(id);
        saveJSON(UNLOCKED_KEY, saved);
      }
    }

    if (open) openPage(id);
  }

  document.addEventListener('click', (e) => {
    const hint = e.target.closest('.page-hint');
    if (hint) unlockPage(hint.dataset.unlock);
  });

  /* --- Сброс прогресса (например, для кнопки «Начать заново») --- */

  function resetProgress() {
    localStorage.removeItem(UNLOCKED_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    location.reload();
  }

  /* --- Запуск --- */

  function init() {
    // 1. Восстанавливаем разблокированные досье ДО создания закладок,
    //    чтобы их закладки сразу появились видимыми
    loadJSON(UNLOCKED_KEY, []).forEach((id) => {
      getPage(id)?.classList.remove('page--locked');
    });

    // 2. Создаём закладки для всех листов
    pagesList.querySelectorAll('.page').forEach(createBookmark);

    // 3. Открываем последний просмотренный лист,
    //    а если его нет (или он заблокирован) — первый доступный
    const lastId = loadJSON(ACTIVE_KEY, null);
    const lastPage = lastId ? getPage(lastId) : null;
    const startPage =
      lastPage && !lastPage.classList.contains('page--locked')
        ? lastPage
        : pagesList.querySelector('.page:not(.page--locked)');

    if (startPage) openPage(startPage.dataset.pageId);
  }

  return { init, openPage, unlockPage, resetProgress };
})();

Pages.init();