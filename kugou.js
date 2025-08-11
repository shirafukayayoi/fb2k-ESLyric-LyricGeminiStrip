/*

*/

export function getConfig(cfg) {
  cfg.name = "酷狗音乐";
  cfg.version = "0.1";
  cfg.author = "anonymous";
}

export function getLyrics(meta, man) {
  if (meta.duration == 0) {
    return;
  }

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

  function isCoverTitle(title) {
    let t = (title || "").toLowerCase();
    return /(cover|covered\s+by|歌ってみた|カバー|カバ―|翻唱|歌ってみ|ver\.?|version)/i.test(
      t
    );
  }
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
        );
      s = s.replace(/\s*-\s*([^\-]*)$/, (m, p1) =>
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

  function log(msg) {
    console.log("[kugou]" + msg);
  }

  function runKugouSearch(withTitle, dropSinger) {
    // Search with title only
    let keyword = withTitle;
    log(`[title] search keyword="${keyword}" dropSinger=${!!dropSinger}`);
    let url =
      "http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&keyword=" +
      encodeURIComponent(keyword) +
      "&duration=" +
      Math.round(meta.duration) * 1000 +
      "&hash=";

    let lyricCandidates = [];
    request(url, (err, res, body) => {
      if (!err && res.statusCode == 200) {
        try {
          let obj = JSON.parse(body);
          let candidates = obj["candidates"] || [];
          log(`[search] candidates=${candidates.length}`);
          for (const item of candidates) {
            if (item["id"] === null) continue;
            if (item["accesskey"] === null) continue;
            lyricCandidates.push({
              id: item["id"],
              key: item["accesskey"],
              title: item["song"] || "",
              artist: item["singer"] || "",
            });
          }
        } catch (e) {}
      }

      let lyric_meta = man.createLyric();
      for (const candidate of lyricCandidates) {
        log(
          `[download] id=${candidate.id} title="${candidate.title}" artist="${candidate.artist}"`
        );
        let dl =
          "http://lyrics.kugou.com/download?ver=1&client=pc&id=" +
          candidate.id +
          "&accesskey=" +
          candidate.key +
          "&fmt=krc&charset=utf8";
        request(dl, (err, res, body) => {
          if (!err && res.statusCode == 200) {
            try {
              let obj = JSON.parse(body);
              if (obj["content"]) {
                lyric_meta.title = candidate.title;
                lyric_meta.artist = candidate.artist;
                lyric_meta.lyricData = base64Decode(obj["content"]);
                lyric_meta.fileType = "krc";
                man.addLyric(lyric_meta);
              }
            } catch (e) {
              console.log(e);
            }
          }
        });
      }
    });
  }

  const coverLikely = isCoverTitle(meta.title || "");
  const regexTitle = normalizeTitleWithRegex(meta.title || "");
  const rawTitle = meta.title || "";
  log(
    `[title] raw="${rawTitle}" regex="${regexTitle}" geminiEnabled=${GEMINI_ENABLED && !!GEMINI_API_KEY} coverLikely=${coverLikely}`
  );
  if (GEMINI_ENABLED && GEMINI_API_KEY) {
    callGeminiExtractTitle(meta.title || "", (geminiTitle) => {
      const finalTitle =
        normalizeTitleWithRegex(geminiTitle || regexTitle) ||
        regexTitle ||
        meta.title ||
        "";
      log(`[title] gemini="${geminiTitle || ""}" final="${finalTitle}"`);
      runKugouSearch(finalTitle, coverLikely);
    });
  } else {
    const finalTitle = regexTitle || meta.title || "";
    log(`[title] final="${finalTitle}" (regex only)`);
    runKugouSearch(finalTitle, coverLikely);
  }
}

// base64 decode
function base64Decode(str) {
  let base64Chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64Table = new Uint8Array(256);
  for (let i = 0; i < base64Chars.length; ++i) {
    base64Table[base64Chars.charCodeAt(i)] = i;
  }

  let bufLen = str.length * 0.75;
  let arrBuf = new ArrayBuffer(bufLen);
  let bytes = new Uint8Array(arrBuf);

  let cursor = 0;
  for (let i = 0; i < str.length; i += 4) {
    let c1 = base64Table[str.charCodeAt(i)];
    let c2 = base64Table[str.charCodeAt(i + 1)];
    let c3 = base64Table[str.charCodeAt(i + 2)];
    let c4 = base64Table[str.charCodeAt(i + 3)];
    bytes[cursor++] = (c1 << 2) | (c2 >> 4);
    bytes[cursor++] = ((c2 & 15) << 4) | (c3 >> 2);
    bytes[cursor++] = ((c3 & 3) << 6) | (c4 & 63);
  }
  return arrBuf;
}
