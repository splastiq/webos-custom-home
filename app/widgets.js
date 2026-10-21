/* Clock, connectivity, and weather have an independent lifecycle from navigation. */
(function () {
  'use strict';
  var config = window.HOME_CONFIG;
  var storage = window.HomeStorage;
  var weatherRequest = null;
  var lastMinute = null;
  var clockTimer;
  function el(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function clock() {
    var now = new Date();
    var minsk = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    var minute = Math.floor(minsk.getTime() / 60000);
    if (minute === lastMinute) { return; } lastMinute = minute;
    var hour = minsk.getHours();
    el('clock').textContent = pad(hour) + ':' + pad(minsk.getMinutes());
    el('date').textContent = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][minsk.getDay()] + ', ' + minsk.getDate() + ' ' + ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][minsk.getMonth()] + ' ' + minsk.getFullYear();
    el('greeting').textContent = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  }
  function weatherInfo(code) {
    if (code === 0) { return ['☀', 'Ясно']; }
    if (code <= 3) { return ['☁', 'Облачно']; }
    if (code <= 48) { return ['≋', 'Туман']; }
    if (code <= 67 || (code >= 80 && code <= 82)) { return ['☂', 'Дождь']; }
    if (code <= 77 || code === 85 || code === 86) { return ['❄', 'Снег']; }
    return ['ϟ', 'Гроза'];
  }
  function renderWeather(data, cached) {
    el('weather-icon').parentNode.parentNode.hidden = false;
    var info = weatherInfo(data.code);
    el('weather-icon').textContent = info[0];
    el('temperature').textContent = Math.round(data.temperature) + '°';
    el('weather-description').textContent = info[1] + ' · Минск';
    el('weather-note').textContent = '';
  }
  function network() {
    var offline = navigator.onLine === false;
    el('network').textContent = offline ? 'Нет сети' : 'Сеть подключена';
    el('network').classList.toggle('offline', offline);
  }
  function weather() {
    if (document.hidden) { return; }
    network();
    var cached = storage.get('home.weather.v1');
    if (cached && typeof cached.temperature === 'number' && typeof cached.code === 'number' && typeof cached.savedAt === 'number') { renderWeather(cached, true); }
    if (navigator.onLine === false || weatherRequest || document.hidden) {
      return;
    }
    if (cached && Date.now() - cached.savedAt < config.weatherInterval) { return; }
    var xhr = new XMLHttpRequest();
    weatherRequest = xhr;
    function failed() { weatherRequest = null; }
    xhr.open('GET', config.weatherUrl, true);
    xhr.timeout = 10000;
    xhr.onload = function () {
      weatherRequest = null;
      try {
        if (xhr.status < 200 || xhr.status >= 300) { failed(); return; }
        var current = JSON.parse(xhr.responseText).current;
        if (!current || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') { failed(); return; }
        var data = { temperature: current.temperature_2m, code: current.weather_code, savedAt: Date.now() };
        storage.set('home.weather.v1', data);
        renderWeather(data, false);
      } catch (e) { failed(); }
    };
    xhr.onerror = failed;
    xhr.ontimeout = failed;
    xhr.onabort = function () { weatherRequest = null; };
    xhr.send();
  }
  function tick() {
    clearTimeout(clockTimer);
    if (document.hidden) { return; }
    clock(); clockTimer = setTimeout(tick, 60000 - Date.now() % 60000 + 20);
  }
  window.HomeWidgets = { init: function () {
    tick(); weather();
    window.addEventListener('online', weather);
    window.addEventListener('offline', weather);
    document.addEventListener('visibilitychange', function () {
      tick();
      if (document.hidden) { if (weatherRequest) { weatherRequest.abort(); } }
      else { weather(); }
    });
    setInterval(weather, config.weatherInterval);
  } };
}());
