/* Application IDs and icons verified on LG 49SJ810V. */
window.HOME_CONFIG = {
  apps: [
    { key: 'lampa', name: 'Лампа', id: 'lampa.tv', icon: 'app-icons/lampa.png' },
    { key: 'youtube', name: 'YouTube AdFree', id: 'youtube.leanback.v4', icon: 'app-icons/youtube.svg' },
    { key: 'homebrew', name: 'Homebrew Channel', id: 'org.webosbrew.hbchannel', icon: 'app-icons/homebrew.png' },
    { key: 'apple-tv', name: 'Apple TV', id: 'com.apple.appletv.web', icon: 'app-icons/apple-tv.png' },
    { key: 'kinopoisk', name: 'Кинопоиск', id: 'com.685631.3411', icon: 'app-icons/kinopoisk.png' },
    { key: 'spotify', name: 'Spotify', id: 'spotify-beehive', icon: 'app-icons/spotify.png' }
  ],
  inputs: [
    { name: 'PlayStation 4', id: 'com.webos.app.hdmi2', port: 'HDMI 2', icon: 'input-icons/playstation.svg' },
    { name: 'Mobile Device', id: 'com.webos.app.hdmi1', port: 'HDMI 1', icon: 'input-icons/apple.svg' }
  ],
  weatherUrl: 'https://api.open-meteo.com/v1/forecast?latitude=53.9&longitude=27.5667&current=temperature_2m,weather_code&timezone=Europe%2FMinsk',
  screensaver: { enabled: true, idleMs: 120000, loadTimeoutMs: 12000, rotationMs: 300000 },
  weatherInterval: 1800000
};
