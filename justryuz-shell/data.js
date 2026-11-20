/* Mock content. Replace with real posts later (all values are plain text). */
window.SITE = {
  nav: [
    { label: "home", href: "#" },
    { label: "blog", href: "#blog" },
    { label: "writeups", href: "#writeups" },
    { label: "notes", href: "#notes" },
    { label: "tools", href: "#" },
    { label: "search", href: "#q" },
    { label: "about", href: "#" },
    { label: "contact", href: "mailto:me@justryuz.my", hot: true }
  ],

  slides: [
    {
      title: "Selamat datang ke justryuz blog",
      body: [
        "Nota security, Linux dan writeup CTF dalam satu tempat.",
        "Semua kandungan untuk tujuan pembelajaran."
      ],
      chips: ["linux", "ctf", "pentest", "notes"]
    },
    {
      title: "Cabaran: login ke shell privat",
      body: [
        "Mula sebagai guest, selesaikan puzzle level demi level.",
        "Password sebenar hanya disahkan di server, bukan di halaman ini."
      ],
      chips: ["ssh guest@git.justryuz.my"]
    },
    {
      title: "Langgan nota terbaru",
      body: [
        "Post baru ditambah setiap minggu.",
        "Hantar cadangan topik melalui email."
      ],
      chips: ["me@justryuz.my"]
    }
  ],

  /* level: 1 (mudah) .. 5 (susah) */
  groups: [
    {
      id: "blog",
      title: "latest posts",
      posts: [
        { date: "2025-01-12", title: "Setup VPS selamat: SSH key, fail2ban, ufw", type: "linux", hits: 1840, level: 2, author: "justryuz" },
        { date: "2025-01-05", title: "Kenapa password di JS statik tidak pernah rahsia", type: "web", hits: 2210, level: 1, author: "justryuz" },
        { date: "2024-12-28", title: "Cloudflare Worker sebagai auth gateway kecil", type: "web", hits: 960, level: 3, author: "justryuz" },
        { date: "2024-12-20", title: "Hardening nginx: header, rate limit, TLS", type: "linux", hits: 1320, level: 3, author: "justryuz" }
      ]
    },
    {
      id: "writeups",
      title: "ctf writeups",
      posts: [
        { date: "2025-01-10", title: "Bandit level 0-10: asas Linux CLI", type: "linux", hits: 3120, level: 1, author: "justryuz" },
        { date: "2025-01-02", title: "Crypto: Vigenere dengan kunci pendek", type: "crypto", hits: 540, level: 2, author: "justryuz" },
        { date: "2024-12-18", title: "Forensik: cari flag dalam pcap", type: "forensic", hits: 705, level: 3, author: "justryuz" },
        { date: "2024-12-02", title: "Pwn: stack buffer overflow tanpa canary", type: "pwn", hits: 410, level: 5, author: "justryuz" }
      ]
    },
    {
      id: "notes",
      title: "quick notes",
      posts: [
        { date: "2025-01-08", title: "Cheatsheet grep, awk, sed untuk log", type: "linux", hits: 1500, level: 1, author: "justryuz" },
        { date: "2024-12-30", title: "Nota tcpdump dan Wireshark filter", type: "network", hits: 880, level: 2, author: "justryuz" },
        { date: "2024-12-11", title: "Git: simpan rahsia di luar repo (.env, .gitignore)", type: "git", hits: 1190, level: 1, author: "justryuz" }
      ]
    }
  ]
};
