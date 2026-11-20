/* Site content. To publish a new article, add an object to a group's `posts`.
   Fields:
     slug     unique id, used in post.html?p=<slug>
     title, date (YYYY-MM-DD), type (category), platform, level (1-5), hits
     summary  one line for the list
     body     array of blocks: {t:"p"|"h"|"code", x:"text"}  (plain text only)
     tags     array of strings
     tested   "Linux, Windows"   ref  optional source/URL text
   All values are rendered as plain text (no HTML). */
window.SITE = {
  nav: [
    { label: "home", href: "index.html" },
    { label: "ssh", href: "login.html" },
    { label: "contact", href: "mailto:me@justryuz.my", hot: true }
  ],

  author: { name: "justryuz", level: "5", email: "me@justryuz.my", verified: true },

  groups: [
    {
      id: "blog",
      title: "latest posts",
      posts: [
        {
          slug: "setup-vps-selamat", date: "2025-01-12", type: "linux", platform: "ubuntu", level: 2, hits: 1840,
          title: "Setup VPS selamat: SSH key, fail2ban, ufw",
          summary: "Langkah asas hardening VPS baru.",
          tags: ["ssh", "fail2ban", "ufw", "vps"], tested: "Ubuntu 22.04",
          body: [
            { t: "p", x: "Selepas VPS baru siap, buat tiga perkara sebelum apa-apa lagi: matikan login password, hidupkan firewall, dan pasang pencegah brute force." },
            { t: "h", x: "1. SSH key sahaja" },
            { t: "code", x: "ssh-keygen -t ed25519\nssh-copy-id user@server\n# /etc/ssh/sshd_config\nPasswordAuthentication no\nPermitRootLogin no" },
            { t: "h", x: "2. Firewall" },
            { t: "code", x: "ufw default deny incoming\nufw allow 22/tcp\nufw allow 443/tcp\nufw enable" },
            { t: "h", x: "3. fail2ban" },
            { t: "code", x: "apt install fail2ban\nsystemctl enable --now fail2ban" }
          ]
        },
        {
          slug: "password-di-js-statik", date: "2025-01-05", type: "web", platform: "javascript", level: 1, hits: 2210,
          title: "Kenapa password di JS statik tidak pernah rahsia",
          summary: "Apa sahaja yang sampai ke browser boleh dibaca pengguna.",
          tags: ["javascript", "secrets", "github-pages"], tested: "Chrome, Firefox",
          body: [
            { t: "p", x: "GitHub Pages hanya menghidang fail. Semua yang ada dalam fail itu, termasuk 'env' yang kamu masukkan ke JS, boleh dibaca melalui View Source." },
            { t: "p", x: "Hash tidak membantu untuk password pendek kerana boleh di-brute force secara offline. Jalan yang betul: hantar password ke server kecil (Cloudflare Worker) yang menyimpan rahsia dalam env dan hanya menjawab ya atau tidak." }
          ]
        },
        {
          slug: "cloudflare-worker-auth", date: "2024-12-28", type: "web", platform: "cloudflare", level: 3, hits: 960,
          title: "Cloudflare Worker sebagai auth gateway kecil",
          summary: "Sahkan password di server dengan secret env.",
          tags: ["cloudflare", "worker", "auth"], tested: "Wrangler 3",
          body: [
            { t: "p", x: "Worker menyimpan PASSWORD dan TOKEN_SECRET sebagai secret. Browser hanya menerima token bertandatangan yang tamat dalam 1 jam." },
            { t: "code", x: "npx wrangler secret put PASSWORD\nnpx wrangler secret put TOKEN_SECRET\nnpx wrangler deploy" }
          ]
        },
        {
          slug: "hardening-nginx", date: "2024-12-20", type: "linux", platform: "nginx", level: 3, hits: 1320,
          title: "Hardening nginx: header, rate limit, TLS",
          summary: "Konfigurasi asas nginx yang lebih selamat.",
          tags: ["nginx", "tls", "headers"], tested: "nginx 1.24"
        }
      ]
    },
    {
      id: "writeups",
      title: "ctf writeups",
      posts: [
        {
          slug: "bandit-0-10", date: "2025-01-10", type: "linux", platform: "overthewire", level: 1, hits: 3120,
          title: "Bandit level 0-10: asas Linux CLI",
          summary: "Nota level awal OverTheWire Bandit.",
          tags: ["bandit", "ctf", "cli"], tested: "Linux", ref: "overthewire.org/wargames/bandit"
        },
        {
          slug: "vigenere-kunci-pendek", date: "2025-01-02", type: "crypto", platform: "python", level: 2, hits: 540,
          title: "Crypto: Vigenere dengan kunci pendek",
          summary: "Pecahkan Vigenere guna analisis frekuensi.",
          tags: ["crypto", "vigenere"], tested: "Python 3"
        },
        {
          slug: "forensik-pcap", date: "2024-12-18", type: "forensic", platform: "wireshark", level: 3, hits: 705,
          title: "Forensik: cari flag dalam pcap",
          summary: "Ikuti stream TCP untuk jumpa flag.",
          tags: ["pcap", "wireshark"], tested: "Wireshark 4"
        },
        {
          slug: "pwn-stack-overflow", date: "2024-12-02", type: "pwn", platform: "linux", level: 5, hits: 410,
          title: "Pwn: stack buffer overflow tanpa canary",
          summary: "Overwrite return address pada binari 64-bit.",
          tags: ["pwn", "bof", "gdb"], tested: "Linux x86_64"
        }
      ]
    },
    {
      id: "notes",
      title: "quick notes",
      posts: [
        {
          slug: "cheatsheet-grep-awk-sed", date: "2025-01-08", type: "linux", platform: "bash", level: 1, hits: 1500,
          title: "Cheatsheet grep, awk, sed untuk log",
          summary: "Contoh ringkas untuk tapis log.",
          tags: ["grep", "awk", "sed"], tested: "GNU coreutils",
          body: [
            { t: "code", x: "grep -i 'failed' auth.log\nawk '{print $1}' access.log | sort | uniq -c | sort -nr | head\nsed -n '10,20p' file.log" }
          ]
        },
        {
          slug: "tcpdump-wireshark", date: "2024-12-30", type: "network", platform: "linux", level: 2, hits: 880,
          title: "Nota tcpdump dan Wireshark filter",
          summary: "Filter yang kerap dipakai.",
          tags: ["tcpdump", "wireshark"], tested: "Linux"
        },
        {
          slug: "git-rahsia-env", date: "2024-12-11", type: "git", platform: "git", level: 1, hits: 1190,
          title: "Git: simpan rahsia di luar repo (.env, .gitignore)",
          summary: "Jangan commit rahsia. Kalau sudah, putar semula.",
          tags: ["git", "env", "secrets"], tested: "git 2.4x"
        }
      ]
    }
  ]
};
