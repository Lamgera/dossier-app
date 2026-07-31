// src/scripts/index.js
const cover = document.querySelector('.folder__cover');
const openBtn = document.querySelector('.cover-button');

openBtn.addEventListener('click', () => {
  cover.classList.toggle('animated');
});