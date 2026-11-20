/* Public config for the SSH login page.
   - Nothing here is a real secret. Level passwords are stored as SHA-256 hashes
     (puzzle only; anyone can read the source, that is part of the game).
   - The REAL password lives only in the Cloudflare Worker env (see worker/). */
window.CONFIG = {
  host: "git.justryuz.my",
  /* Other host names accepted by the ssh command (virtual terminal only). */
  hostAliases: ["localhost"],

  /* URL of the deployed Worker, e.g. "https://auth.justryuz.my". Empty = real login disabled. */
  API_URL: "https://justryuz-auth.fahmifisal.workers.dev",

  /* Real login user (password is checked by the Worker, never here). */
  ownerUser: "x",

  /* Number of levels per mode. Add more levels below, then add a mode here. */
  modes: { short: 5, medium: 8 },

  /* Guest entry: ssh guest@host, password "guest". */
  guestHash: "84983c60f7daadc1cb8698621f802c0d9f9a3c3c295c810748fb048115c186ec",

  /* hashes[k] = SHA-256 of the password for level k. hashes[N] opens "victor" (the finish). */
  hashes: {
    1: "41722dd9e83abf27c98e9f2d6193d60cbeb9de86e19b70b40dfc573f202522be",
    2: "a062e9252eb6309187806d8f40733e11b612d42d7cb74eefd5126dc63fd01224",
    3: "9a9943c7ca9adcfe976969cfd5e0759bd3e12b7c0c3362ecc7ad61efeae2cf6f",
    4: "572dbab02ecee6ce4c66cf7cd8e3242331af43c6e81e98c1c59e826b7ad117a2",
    5: "83bc44afd3bb96e4e1f232b91a21d6f39dd9cebf82454215478c75549dbfb87e",
    6: "1b703016d83b47b181cdee1c0f68c6644ef49476bc3d1b2723c56ddd80cc4c66",
    7: "66b942c55fbb03907f1c10cc939fac3cee05a45bdb2b636539c721725c787cdb",
    8: "77742991de48e0fd9c47820d2252e4f427925f96ab37bb5b7cfc5c7536ef6d6a"
  },

  flag: "FLAG{justryuz_sh3ll_pwn3d}",

  /* Virtual filesystem per level. string = file, object = directory. */
  levels: [
    { /* level0 */
      goal: "Cari password untuk level1.",
      hint: "Cuba: ls, kemudian cat <fail>",
      fs: { "readme.txt": "Selamat datang ke justryuz-shell.\nPassword level1: n3tcat_42\n" }
    },
    { /* level1 */
      goal: "Password disorok. Fail tersembunyi bermula dengan titik.",
      hint: "ls -a",
      fs: { "readme.txt": "Tiada apa di sini. Mungkin ada fail tersembunyi?\n", ".pass": "d0tf1le\n" }
    },
    { /* level2 */
      goal: "Kandungan fail dikodkan base64.",
      hint: "base64 -d notes.b64",
      fs: { "readme.txt": "Fail notes.b64 ialah base64.\n", "notes.b64": "YjRzZTY0ZnR3\n" }
    },
    { /* level3 */
      goal: "Teks ditukar dengan ROT13.",
      hint: "rot13 msg.rot13",
      fs: { "readme.txt": "msg.rot13 ditulis dengan ROT13.\n", "msg.rot13": "e0g13_rm\n" }
    },
    { /* level4 */
      goal: "Log panjang. Cari baris yang ada 'password'.",
      hint: "grep password server.log",
      fs: { "readme.txt": "Jangan baca log satu-satu. Guna grep.\n", "server.log": buildLog() }
    },
    { /* level5 */
      goal: "Data dalam bentuk hex.",
      hint: "unhex dump.hex",
      fs: { "readme.txt": "dump.hex ialah teks dalam hex.\n", "dump.hex": "6833785f64756d7039\n" }
    },
    { /* level6 */
      goal: "Password ada di dalam folder yang dalam.",
      hint: "cd archive, cd 2024, cd old, ls -a",
      fs: {
        "readme.txt": "Terokai folder archive.\n",
        archive: {
          "index.txt": "bukan di sini\n",
          "2023": { "x.txt": "kosong\n" },
          "2024": {
            "a.txt": "bukan di sini\n",
            old: { "note.txt": "cuba ls -a\n", ".key": "d33p_d1r\n" }
          }
        }
      }
    },
    { /* level7 */
      goal: "Dua lapis: base64 kemudian ROT13. Guna paip (|).",
      hint: "base64 -d final.enc | rot13",
      fs: { "readme.txt": "final.enc dikodkan dua kali.\n", "final.enc": "Y3ZjM194MWF0\n" }
    }
  ]
};

/* Builds a long fake log with one interesting line. */
function buildLog() {
  var lines = [];
  var msgs = ["INFO service started", "INFO connection accepted", "WARN slow query", "INFO cache refreshed", "DEBUG heartbeat ok"];
  for (var i = 0; i < 60; i++) {
    var hh = ("0" + (i % 24)).slice(-2);
    lines.push("2025-01-10 " + hh + ":" + ("0" + (i * 7 % 60)).slice(-2) + " " + msgs[i % msgs.length]);
    if (i === 37) lines.push("2025-01-10 13:37 NOTICE config loaded password=gr3p_m4st3r");
  }
  return lines.join("\n") + "\n";
}
