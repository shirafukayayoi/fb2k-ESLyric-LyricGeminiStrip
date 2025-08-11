/*

all credits to：
https://github.com/Binaryify/NeteaseCloudMusicApi
https://github.com/entronad/crypto-es

*/

import crypto from "crypto-es/lib/index.js";

evalLib("querystring/querystring.min.js");

const iv = crypto.enc.Latin1.parse("0102030405060708");
const linuxapiKey = crypto.enc.Latin1.parse("rFgB&h#%2?^eDg:Q");
const anonymousToken =
  "bf8bfeabb1aa84f9c8c3906c04a04fb864322804c83f5d607e91a04eae463c9436bd1a17ec353cf780b396507a3f7464e8a60f4bbc019437993166e004087dd32d1490298caf655c2353e58daa0bc13cc7d5c198250968580b12c1b8817e3f5c807e650dd04abd3fb8130b7ae43fcc5b";

const aesEncrypt = (buffer, mode, key, iv) => {
  const cipher = crypto.AES.encrypt(buffer, key, { mode: mode, iv: iv });
  return cipher.ciphertext;
};

const linuxapi = (object) => {
  const text = JSON.stringify(object);
  return {
    eparams: aesEncrypt(
      crypto.enc.Utf8.parse(text),
      crypto.mode.ECB,
      linuxapiKey,
      iv
    )
      .toString(crypto.enc.Hex)
      .toUpperCase(),
  };
};

const doRequest = (method, url, data, options) => {
  return new Promise((resolve, reject) => {
    let headers = {};
    if (method.toUpperCase() === "POST")
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (url.includes("music.163.com"))
      headers["Referer"] = "https://music.163.com";
    if (options.crypto === "linuxapi") {
      data = linuxapi({
        method: method,
        url: url.replace(/\w*api/, "api"),
        params: data,
      });
      headers["User-Agent"] =
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36";
      headers["Cookie"] = `MUSIC_A=${anonymousToken}`;
      url = "https://music.163.com/api/linux/forward";
    } else {
      reject();
      return;
    }
    const settings = {
      method: method,
      url: url,
      headers: headers,
      body: querystring.stringify(data),
    };
    request(settings, (err, res, body) => {
      if (!err && res.statusCode === 200) resolve(body);
      else reject(err, res);
    });
  }).catch((error) => console.log(error.message));
};

const procKeywords = (str) => {
  var s = str;
  s = s.toLowerCase();
  s = s.replace(/\'|·|\$|\&|–/g, "");
  //truncate all symbols
  s = s.replace(/\(.*?\)|\[.*?]|{.*?}|（.*?/g, "");
  s = s.replace(/[-/:-@[-`{-~]+/g, "");
  s = s.replace(
    /[\u2014\u2018\u201c\u2026\u3001\u3002\u300a\u300b\u300e\u300f\u3010\u3011\u30fb\uff01\uff08\uff09\uff0c\uff1a\uff1b\uff1f\uff5e\uffe5]+/g,
    ""
  );
  return s;
};

export function getConfig(config) {
  config.name = "网易云音乐";
  config.version = "0.3";
  config.author = "ohyeah";
}

export function getLyrics(meta, man) {
  // ===== Title normalization + optional Gemini extraction =====
  const DEFAULT_GEMINI_ENABLED = false;
  const DEFAULT_GEMINI_API_KEY = ""; // Please set your API key
  const GEMINI_MODEL = "gemini-2.5-flash-lite";
  const GEMINI_ENABLED =
    ((man.getSvcData && man.getSvcData("gemini_enabled")) ||
      (DEFAULT_GEMINI_ENABLED ? "1" : "0")) === "1";
  const GEMINI_API_KEY =
    (man.getSvcData && man.getSvcData("gemini_api_key")) ||
    DEFAULT_GEMINI_API_KEY;

  function stripBracketsOnce(s) {
    let prev;
    do {
      prev = s;
      s = s
        .replace(/\s*[\[\(（【｛{].*?[\]\)）】｝}]\s*$/, "")
        .replace(/\s*[|｜／/\\]\s*([^|｜／/\\]*)$/, (m, p1) =>
          /(cover|covered\s+by|歌ってみた|カバー|翻唱|official|mv|pv|remix|short|full|ver\.?|version|live)/i.test(
            p1
          )
            ? ""
            : m
        )
        .replace(/\s*-\s*([^\-]*)$/, (m, p1) =>
          /(cover|covered\s+by|歌ってみた|カバー|翻唱|official|mv|pv|remix|short|full|ver\.?|version|live)/i.test(
            p1
          )
            ? ""
            : m
        );
    } while (s !== prev);
    return s;
  }
  function normalizeTitleWithRegex(title) {
    if (!title) return title;
    let t = title.trim();
    t = t.replace(/[\u2460-\u24FF\u2600-\u27BF]+/g, "");
    t = t.replace(
      /\s*(?:covered\s+by|cover\s*by|cover|歌ってみた|カバー|翻唱)\b.*$/i,
      ""
    );
    t = t.replace(/\s*(?:feat\.|ft\.|featuring)\b.*$/i, "");
    t = t.replace(/\s*(?:prod\.|produced\s+by)\b.*$/i, "");
    t = stripBracketsOnce(t);
    t = t.replace(/^["'「『【\[]+|["'」』】\]]+$/g, "").trim();
    t = t.replace(/\s{2,}/g, " ");
    t = t.split(/\s*(?:\/|／|\||｜|-|・|·|~|〜)\s*/)[0];
    return t;
  }
  function callGeminiExtractTitle(rawTitle, cb) {
    if (!GEMINI_ENABLED || !GEMINI_API_KEY) {
      cb(null);
      return;
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const prompt = [
      "The following is a music track title. Output requirements:",
      "1) Return only the song name as a single phrase.",
      "2) Ignore all artist names/composers/arrangers/producers/feat・ft・featuring/ver・version/MV・PV/live/remix/short・full/cover・covered by・歌ってみた・翻唱/hashtags/emojis/【】()[] annotations.",
      "3) For multiple segments separated by delimiters (/, ／, |, ｜, -, ・, ·, ~, 〜, :, ：), adopt only the left main segment corresponding to the song name.",
      "4) Do not add quotes or extra words. Remove leading and trailing spaces.",
      "Example 1: '少女レイ / みきとP cover 9Lana' → '少女レイ'",
      "Example 2: 'のだ covered by Mirea Sheltzs ・陽月るるふ・よしか⁂【歌ってみた】' → 'のだ'",
      "Example 3: 'KING feat. Kanaria (Official MV)' → 'KING'",
      `Input: ${rawTitle}`,
    ].join("\n");
    const settings = {
      method: "post",
      url: endpoint,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    };
    request(settings, (err, res, body) => {
      if (err || res.statusCode != 200) {
        cb(null);
        return;
      }
      try {
        const obj = JSON.parse(body);
        const parts =
          obj &&
          obj.candidates &&
          obj.candidates[0] &&
          obj.candidates[0].content &&
          obj.candidates[0].content.parts;
        let text =
          parts && parts.length ? parts.map((p) => p.text || "").join("") : "";
        cb(
          (text || "").trim().replace(/^["'「『【\[]+|["'」』】\]]+$/g, "") ||
            null
        );
      } catch {
        cb(null);
      }
    });
  }

  function logMsg(msg) {
    console.log("[netease]" + msg);
  }

  function proceed(searchTitle) {
    var title = procKeywords(searchTitle);
    // Search with title only
    var artist = "";

    const data = {
      s: title,
      type: 1,
      limit: 10,
      offset: 0,
    };

    doRequest("POST", "https://music.163.com/weapi/search/get", data, {
      crypto: "linuxapi",
    }).then((body) => {
      let candicates = [];
      candicates = parseSearchResults(body);
      for (const item of candicates) {
        const queryData = {
          id: item.id,
        };
        doRequest(
          "POST",
          "https://music.163.com/weapi/song/lyric?lv=-1&kv=-1&tv=-1",
          queryData,
          { crypto: "linuxapi" }
        ).then((body) => {
          parseLyricResponse(item, man, body);
        });
      }
    });
    // loop to 'wait' callback(promise)
    messageLoop(0);
  }

  const regexTitle = normalizeTitleWithRegex(meta.rawTitle || meta.title || "");
  const rawTitle = meta.rawTitle || meta.title || "";
  logMsg(
    `[title] raw="${rawTitle}" regex="${regexTitle}" geminiEnabled=${GEMINI_ENABLED && !!GEMINI_API_KEY}`
  );
  if (GEMINI_ENABLED && GEMINI_API_KEY) {
    callGeminiExtractTitle(rawTitle, (geminiTitle) => {
      const finalTitle =
        normalizeTitleWithRegex(geminiTitle || regexTitle) ||
        regexTitle ||
        rawTitle;
      logMsg(`[title] gemini="${geminiTitle || ""}" final="${finalTitle}"`);
      proceed(finalTitle);
    });
  } else {
    const finalTitle = regexTitle || rawTitle;
    logMsg(`[title] final="${finalTitle}" (regex only)`);
    proceed(finalTitle);
  }
}

function parseSearchResults(body) {
  let candicates = [];
  try {
    let obj = JSON.parse(body);
    let results = obj["result"] || {};
    let songs = results["songs"] || [];
    for (const song of songs) {
      if (
        typeof song["id"] === "undefined" ||
        typeof song["name"] === "undefined"
      )
        continue;
      let id = song["id"];
      let title = song["name"];
      let artist = "";
      let artists = song["artists"] || [];
      for (const item of artists) {
        if ("name" in item) {
          artist = item["name"];
          break;
        }
      }
      let album = song["album"] || {};
      album = album["name"] || "";
      candicates.push({ id: id, title: title, artist: artist, album: album });
    }
  } catch (e) {}
  return candicates;
}

function parseLyricResponse(item, man, body) {
  try {
    let lyricObj = JSON.parse(body);
    let lyricText = "";
    if (lyricObj["lrc"]) {
      lyricText = lyricObj["lrc"]["lyric"] || "";
      let version = lyricObj["lrc"]["version"] || 0;
      if (version == 1) return;
    }
    if (lyricObj["tlyric"]) {
      lyricText += lyricObj["tlyric"]["lyric"] || "";
    }

    let meta = man.createLyric();
    meta.title = item.title;
    meta.artist = item.artist;
    meta.album = item.album;
    meta.lyricText = lyricText;
    man.addLyric(meta);
    /*
        lyricText = '';
        if (lyricObj['klyric']) {
            lyricText = lyricObj['klyric']['lyric'] || '';
        }

        if (lyricText != '') {
            meta.title += ' (Enhanced LRC)';
            meta.lyricText = parseKLyric(lyricText);
            console.log(meta.lyricText);
            man.addLyric(meta);
        }
        */
  } catch (e) {
    console.log(e);
  }
}

function parseKLyric(lyricText) {
  let enhancedlyricText = "";
  let matches;
  let metaRegex = /^\[(\S+):(\S+)\]$/;
  let timestampsRegex = /^\[(\d+),(\d+)\]/;
  let timestamps2Regex = /\((\d+),(\d+)\)([^\(]*)/g;
  let lines = lyricText.split(/[\r\n]/);
  for (const line of lines) {
    console.log(line);
    if ((matches = metaRegex.exec(line))) {
      // meta info
      enhancedlyricText += matches[0] + "\r\n";
    } else if ((matches = timestampsRegex.exec(line))) {
      let lyricLine = "";
      let startTime = parseInt(matches[1]);
      let duration = parseInt(matches[2]);
      lyricLine = "[" + formatTime(startTime) + "]";
      // parse sub-timestamps
      let subMatches;
      let subStartTime = startTime;
      while ((subMatches = timestamps2Regex.exec(line))) {
        let subDuration = parseInt(subMatches[2]);
        let subWord = subMatches[3];
        lyricLine += "<" + formatTime(subStartTime) + ">" + subWord;
        subStartTime += subDuration;
      }
      lyricLine += "<" + formatTime(startTime + duration) + ">";
      enhancedlyricText += lyricLine + "\r\n";
    }
  }
  return enhancedlyricText;
}

function zpad(n) {
  var s = n.toString();
  return s.length < 2 ? "0" + s : s;
}

function formatTime(time) {
  var t = Math.abs(time / 1000);
  var h = Math.floor(t / 3600);
  t -= h * 3600;
  var m = Math.floor(t / 60);
  t -= m * 60;
  var s = Math.floor(t);
  var ms = t - s;
  var str =
    (h ? zpad(h) + ":" : "") +
    zpad(m) +
    ":" +
    zpad(s) +
    "." +
    zpad(Math.floor(ms * 100));
  return str;
}
