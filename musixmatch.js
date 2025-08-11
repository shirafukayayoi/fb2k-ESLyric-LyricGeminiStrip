export function getConfig(cfg) {
  cfg.name = "Musixmatch";
  cfg.version = "0.1";
  cfg.author = "ohyeah";
  cfg.useRawMeta = false;
}

export function getLyrics(meta, man) {
  evalLib("querystring/querystring.min.js");

  let token = queryToken(man);
  if (token == "") {
    log("cannot query token!");
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
    // Split by delimiters (/ ／ | ｜ - ・ · ~ 〜) and adopt the left side (song name)
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

  function proceed(searchTitle) {
    let params = {
      user_language: "en",
      app_id: "web-desktop-app-v1.0",
      format: "json",
      subtitle_format: "lrc",
      q_track: searchTitle,
      q_artist: "",
      q_album: "",
      f_has_lyrics: 1,
      usertoken: token,
      t: new Date().getTime(),
    };

    let headers = {};
    headers["cookie"] = "AWSELBCORS=0; AWSELB=0";

    let url = "https://apic-desktop.musixmatch.com/ws/1.1/track.search?";
    url += querystring.stringify(params);

    let settings = {
      url: url,
      method: "GET",
      headers: headers,
    };

    let songList = [];
    request(settings, (err, res, body) => {
      if (err || res.statusCode != 200) {
        return;
      }

      try {
        let obj = JSON.parse(body);
        let trackList = obj["message"]["body"]["track_list"];
        for (const trackObj of trackList) {
          let track = trackObj["track"];
          let id = track["commontrack_id"] | 0;
          let title = track["track_name"];
          let artist = track["artist_name"];
          let album = track["album_name"];
          let has_lyrics = track["has_lyrics"] | 0;
          let has_subtitles = track["has_subtitles"] | 0;

          if (id == 0) {
            continue;
          }

          if (has_lyrics == 0 && has_subtitles == 0) {
            continue;
          }

          songList.push({
            id: id,
            title: title,
            artist: artist,
            album: album,
            has_lyrics: has_lyrics != 0 ? true : false,
            has_subtitles: has_subtitles != 0 ? true : false,
          });
        }
      } catch (e) {
        log("parse exception: " + e.message);
      }

      let lyricMeta = man.createLyric();
      for (const song of songList) {
        if (man.checkAbort()) {
          return;
        }

        let lyricText = null;
        if (song.has_subtitles) {
          lyricText = queryLyric(token, song.id, true);
        } else if (song.has_lyrics) {
          lyricText = queryLyric(token, song.id, false);
        }

        if (lyricText == null) {
          continue;
        }

        lyricMeta.title = song.title;
        lyricMeta.artist = song.artist;
        lyricMeta.album = song.album;
        lyricMeta.lyricText = lyricText;
        man.addLyric(lyricMeta);
      }
    });
  }

  const regexTitle = normalizeTitleWithRegex(meta.title || "");
  const rawTitle = meta.title || "";
  log(
    `[title] raw="${rawTitle}" regex="${regexTitle}" geminiEnabled=${GEMINI_ENABLED && !!GEMINI_API_KEY}`
  );
  if (GEMINI_ENABLED && GEMINI_API_KEY) {
    callGeminiExtractTitle(meta.title || "", (geminiTitle) => {
      const finalTitle =
        normalizeTitleWithRegex(geminiTitle || regexTitle) ||
        regexTitle ||
        meta.title ||
        "";
      log(`[title] gemini="${geminiTitle || ""}" final="${finalTitle}"`);
      proceed(finalTitle);
    });
  } else {
    const finalTitle = regexTitle || meta.title || "";
    log(`[title] final="${finalTitle}" (regex only)`);
    proceed(finalTitle);
  }
}

function queryLyric(token, id, isSync) {
  const kUrl =
    "https://apic-desktop.musixmatch.com/ws/1.1/track." +
    (isSync ? "subtitle" : "lyrics") +
    ".get?";
  const kBodyKey = isSync ? "subtitle" : "lyrics";
  const kLyricKey = isSync ? "subtitle_body" : "lyrics_body";
  let params = {
    user_language: "en",
    app_id: "web-desktop-app-v1.0",
    commontrack_id: id,
    usertoken: token,
  };

  let headers = {};
  headers["cookie"] = "AWSELBCORS=0; AWSELB=0";

  let queryUrl = kUrl + querystring.stringify(params);
  let settings = {
    url: queryUrl,
    method: "GET",
    headers: headers,
  };

  let lyricText = null;
  request(settings, (err, res, body) => {
    if (err || res.statusCode != 200) {
      return;
    }

    try {
      let obj = JSON.parse(body);
      lyricText = obj["message"]["body"][kBodyKey][kLyricKey];
      if (lyricText == null) {
        return;
      }
    } catch (e) {
      log("queryLyric exception: " + e.message);
    }
  });

  return lyricText;
}

function queryToken(man) {
  let token = man.getSvcData("token");
  if (token == "") {
    const kUrl = "https://apic-desktop.musixmatch.com/ws/1.1/token.get?";
    let params = {
      user_language: "en",
      app_id: "web-desktop-app-v1.0",
      t: new Date().getTime(),
    };

    let headers = {};
    headers["cookie"] = "AWSELBCORS=0; AWSELB=0";

    let queryUrl = kUrl + querystring.stringify(params);
    let settings = {
      url: queryUrl,
      method: "GET",
      headers: headers,
    };

    log("query token...");

    request(settings, (err, res, body) => {
      if (err || res.statusCode != 200) {
        return;
      }

      try {
        let obj = JSON.parse(body);
        token = obj["message"]["body"]["user_token"] || "";
      } catch (e) {
        log("queryToken exception: " + e.message);
      }
    });

    if (token == "UpgradeOnlyUpgradeOnlyUpgradeOnlyUpgradeOnly") {
      token = "";
    }

    if (token != "") {
      man.setSvcData("token", token);
      man.setSvcData("lastTokenUpdated", new Date().toUTCString());
    }
  }

  return token;
}

function log(str) {
  console.log("[musixmatch]" + str);
}
