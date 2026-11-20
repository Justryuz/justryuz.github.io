# justryuz-shell

## Idea
Blog peribadi di git.justryuz.my dengan gaya hacker (hijau atas hitam) seperti halaman utama Inj3ct0r. Login ala SSH dengan puzzle wargame.

## Keputusan
- Statik: HTML, CSS, JS biasa. Kandungan blog dalam `data.js` (mock).
- Halaman utama: menu `[ ... ]`, header + logo, carousel, search, jadual post (date, description, type, hits, level, author).
- Login: terminal `ssh`, mode Short (5), Medium (8-10), Long (15+) level.
- Password sebenar disahkan di server (Cloudflare Worker, secret env), bukan di JS statik. Password puzzle guest bukan password sebenar.

## Status
- [x] Halaman utama (`index.html`)
- [ ] `login.html` terminal SSH + puzzle
- [ ] Worker `/login` + rate limit
- [ ] Tema (default: hijau CRT) dan pilihan backend perlu disahkan
