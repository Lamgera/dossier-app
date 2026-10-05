const API = {
  baseUrl: "https://randomuser.me/api/",
  timeout: 8000, // таймаут запроса, мс
  maxGenderRetries: 5, // сколько вариантов seed перебрать, чтобы пол совпал
  nat: "gb,fr,de,au", // «гражданства» портретов
};

const DOSSIER = {
  fallbackImage: "./src/images/portrait-placeholder.png", // заглушка при ошибке сети
};

// Кэш уже загруженных профилей, чтобы не дёргать API повторно
const profileCache = new Map();

//Универсальный fetch с таймаутом и обработкой ошибок.
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API.timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Нормализация пола из атрибутов разметки к формату API
function normalizeGender(value) {
  const map = {
    м: "male",
    m: "male",
    муж: "male",
    ж: "female",
    f: "female",
    жен: "female",
  };
  return (
    map[
      String(value || "")
        .trim()
        .toLowerCase()
    ] || "male"
  );
}

// Запросить профиль человека у RandomUser по заданному seed.
export async function fetchDossierProfile(seed, gender = "male") {
  const cacheKey = `${seed}:${gender}`;
  if (profileCache.has(cacheKey)) return profileCache.get(cacheKey);

  for (let attempt = 1; attempt <= API.maxGenderRetries; attempt++) {
    const currentSeed = attempt === 1 ? seed : `${seed}#${attempt}`;

    const url =
      `${API.baseUrl}?seed=${encodeURIComponent(currentSeed)}` +
      `&inc=gender,picture&nat=${API.nat}&noinfo`;

    const data = await fetchJson(url);
    const person = data.results[0];

    // Пол совпал — закрепляем этот портрет за записью
    if (person.gender === gender) {
      const profile = {
        gender: person.gender,
        photo: person.picture.large, // 128×128 — максимум качества у сервиса
        photoId: person.picture.large,
        seed: currentSeed,
      };
      profileCache.set(cacheKey, profile);
      return profile;
    }
    // Иначе пробуем следующий вариант seed
  }

  // Практически недостижимо, но на всякий случай:
  throw new Error(`Не удалось подобрать портрет для seed="${seed}"`);
}

//Предзагрузка изображения (чтобы подмена <img> произошла без «мигания»).
function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () =>
      reject(new Error(`Не удалось загрузить изображение: ${url}`));
    img.src = url;
  });
}

// Загрузить портрет в конкретный <img>. Ожидает атрибуты: data-portrait-seed, data-portrait-gender. При ошибке сети подставляет локальную заглушку.
export async function attachPortrait(img) {
  const seed = img.dataset.portraitSeed;
  const gender = normalizeGender(img.dataset.portraitGender);

  if (!seed) {
    console.warn("[API] У изображения не указан data-portrait-seed", img);
    return;
  }

  img.classList.add("article-portrait--loading");

  try {
    const profile = await fetchDossierProfile(seed, gender);
    await preloadImage(profile.photo);

    img.src = profile.photo;
    img.classList.remove("article-portrait--loading");
    img.classList.add("article-portrait--loaded");
  } catch (error) {
    console.error("[API] Ошибка загрузки портрета:", error.message);
    img.src = DOSSIER.fallbackImage;
    img.classList.remove("article-portrait--loading");
  }
}

//Автоинициализация: находит в документе все фотографии досье(теги <img> с атрибутом data-portrait-seed) и подставляет портреты.
export function initPortraits(root = document) {
  root
    .querySelectorAll("img.article-portrait[data-portrait-seed]")
    .forEach(attachPortrait);
}

// Запуск после построения DOM
document.addEventListener("DOMContentLoaded", () => initPortraits());
