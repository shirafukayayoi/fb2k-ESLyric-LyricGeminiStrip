/*
 All credits to https://github.com/jsososo/QQMusicApi
                https://github.com/xmcp/QRCD
*/

export function getConfig(cfg) {
  cfg.name = "QQ音乐";
  cfg.version = "0.1";
  cfg.author = "ohyeah";
}

export function getLyrics(meta, man) {
  evalLib("querystring/querystring.min.js");

  // 1) Title normalization (call Gemini if needed)
  // Settings: Set the flags and API key below if you want to use Gemini.
  // Default (hardcoded)
  const DEFAULT_GEMINI_ENABLED = false; // Default is disabled
  const DEFAULT_GEMINI_API_KEY = ""; // Default is empty
  const GEMINI_MODEL = "gemini-1.5-flash"; // Lightweight and low latency recommended

  // Priority: Get settings from service data (ESLyric provides man.getSvcData/setSvcData)
  const GEMINI_ENABLED =
    ((man.getSvcData && man.getSvcData("gemini_enabled")) ||
      (DEFAULT_GEMINI_ENABLED ? "1" : "0")) === "1";
  const GEMINI_API_KEY =
    (man.getSvcData && man.getSvcData("gemini_api_key")) ||
    DEFAULT_GEMINI_API_KEY; // Use default if not set

  function isCoverTitle(title) {
    let t = (title || "").toLowerCase();
    return /(cover|covered\s+by|歌ってみた|カバー|カバ―|翻唱|歌ってみ|ver\.?|version)/i.test(
      t
    );
  }

  function stripBracketsOnce(s) {
    // Remove terminal 【】()（）[]{} blocks only once (also handles consecutive terminals)
    let prev;
    do {
      prev = s;
      s = s
        .replace(/\s*[\[\(（【｛{].*?[\]\)）】｝}]\s*$/, "") // Terminal bracketed annotations
        .replace(/\s*[|｜／/\\]\s*([^|｜／/\\]*)$/, (m, p1) => {
          // Drop if what follows the delimiter is annotation-like
          return /(cover|covered\s+by|歌ってみた|カバー|翻唱|official|mv|pv|remix|short|full|ver\.?|version|live)/i.test(
            p1
          )
            ? ""
            : m;
        });
      // Handle " - " delimiter (drop if right side is annotation-like)
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

    // Simple removal of representative decorations, hashtags, emojis, etc.
    // Remove only some decorative elements (BMP range) (Astral plane not supported for old JS compatibility)
    t = t.replace(/[\u2460-\u24FF\u2600-\u27BF]+/g, "");
    // Cut off "covered by" type and "feat." annotations (judge with lower first while maintaining original form)
    t = t.replace(
      /\s*(?:covered\s+by|cover\s*by|cover|歌ってみた|カバー|翻唱)\b.*$/i,
      ""
    );
    t = t.replace(/\s*(?:feat\.|ft\.|featuring)\b.*$/i, "");
    t = t.replace(/\s*(?:prod\.|produced\s+by)\b.*$/i, "");
    t = stripBracketsOnce(t);
    // Remove leading and trailing decorative symbols
    t = t.replace(/^["'「『【\[]+|["'」』】\]]+$/g, "").trim();
    // Normalize consecutive spaces
    t = t.replace(/\s{2,}/g, " ");
    // Split by delimiters and adopt the leftmost (song name) side
    t = t.split(/\s*(?:\/|／|\||｜|-|・|·|~|〜)\s*/)[0];
    return t;
  }

  function callGeminiExtractTitle(rawTitle, cb) {
    if (!GEMINI_ENABLED || !GEMINI_API_KEY) {
      cb(null); // Not used if not set
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

    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const headers = { "Content-Type": "application/json" };
    function log(msg) {
      console.log("[qqmusic]" + msg);
    }
    const settings = {
      method: "post",
      url: endpoint,
      headers: headers,
      body: body,
    };
    log(`[title] search title="${withTitle}" dropSinger=${!!dropSinger}`);

    request(settings, (err, res, body) => {
      if (err || res.statusCode != 200) {
        cb(null);
        return;
      }
      try {
        const obj = JSON.parse(body);
        let text = "";
        const parts =
          obj &&
          obj.candidates &&
          log(`[search] candidates=${song_list.length}`);
        obj.candidates[0] &&
          obj.candidates[0].content &&
          obj.candidates[0].content.parts;
        if (parts && parts.length > 0) {
          text = parts.map((p) => p.text || "").join("");
        }
        text = (text || "")
          .trim()
          .replace(/^["'「『【\[]+|["'」』】\]]+$/g, "");
        cb(text || null);
      } catch (e) {
        cb(null);
      }
    });
  }

  function runQrcSearch(withTitle, dropSinger) {
    function log(msg) {
      console.log("[qqmusic]" + msg);
    }
    log(`[title] search title="${withTitle}" dropSinger=${!!dropSinger}`);
    // query QRC lyrics
    var url = "https://c.y.qq.com/lyric/fcgi-bin/fcg_search_pc_lrc.fcg?";
    var data = {
      SONGNAME: withTitle,
      SINGERNAME: "",
      TYPE: 2,
      RANGE_MIN: 1,
      RANGE_MAX: 20,
    };
    url += querystring.stringify(data);

    var headers = {};
    headers["Referer"] = "https://y.qq.com";

    let settings = {
      method: "get",
      url: url,
      headers: headers,
    };

    var stageSongList = [];
    request(settings, (err, res, body) => {
      if (err || res.statusCode != 200) {
        return;
      }
      var xml_doc = mxml.loadString(body);
      var song_list = xml_doc.findElement("songinfo") || [];
      for (const song of song_list) {
        var id = song.getAttr("id");
        if (id == null) continue;
        var title = decodeURIComponent(getChildElementCDATA(song, "name"));
        var artist = decodeURIComponent(
          getChildElementCDATA(song, "singername")
        );
        var album = decodeURIComponent(getChildElementCDATA(song, "albumname"));

        stageSongList.push({
          id: id,
          title: title,
          artist: artist,
          album: album,
        });
      }

      if (stageSongList.length > 0) {
        let lyricCount = queryLyricV3(meta, man, stageSongList);
        if (lyricCount == null || lyricCount < 1) {
          queryLyricV2(meta, man, stageSongList);
        }
      }
    });
  }

  const coverLikely = isCoverTitle(meta.title || "");
  // まずはローカル規則で抽出
  const regexTitle = normalizeTitleWithRegex(meta.title || "");
  const rawTitle = meta.title || "";
  console.log(
    `[qqmusic][title] raw="${rawTitle}" regex="${regexTitle}" geminiEnabled=${GEMINI_ENABLED && !!GEMINI_API_KEY} coverLikely=${coverLikely}`
  );

  if (GEMINI_ENABLED && GEMINI_API_KEY) {
    // Geminiでの抽出→フォールバックは正規表現
    callGeminiExtractTitle(rawTitle, (geminiTitle) => {
      const finalTitle =
        normalizeTitleWithRegex(geminiTitle || regexTitle) ||
        regexTitle ||
        rawTitle ||
        "";
      console.log(
        `[qqmusic][title] gemini="${geminiTitle || ""}" final="${finalTitle}"`
      );
      runQrcSearch(finalTitle, coverLikely);
    });
  } else {
    // Gemini not used: search with title extracted by regex
    const finalTitle = regexTitle || rawTitle || "";
    console.log(`[qqmusic][title] final="${finalTitle}" (regex only)`);
    runQrcSearch(finalTitle, coverLikely);
  }

  // obsolete
  //queryLyric(meta, man);
}

function queryLyricV3(meta, man, songList) {
  let lyricCount = 0;
  let headers = {};
  headers["Referer"] = "https://y.qq.com";
  headers["Host"] = "u.y.qq.com";
  // notes: some params may not be required, I'm not tested.
  let postData = {
    comm: {
      _channelid: "0",
      _os_version: "6.2.9200-2",
      authst: "",
      ct: "19",
      cv: "1873",
      //guid: '30D1D7C616938DDB575AF16E56D44BD4',
      patch: "118",
      psrf_access_token_expiresAt: 0,
      psrf_qqaccess_token: "",
      psrf_qqopenid: "",
      psrf_qqunionid: "",
      tmeAppID: "qqmusic",
      tmeLoginType: 2,
      uin: "0",
      wid: "0",
    },
    "music.musichallSong.PlayLyricInfo.GetPlayLyricInfo": {
      method: "GetPlayLyricInfo",
      module: "music.musichallSong.PlayLyricInfo",
    },
  };

  for (const song of songList) {
    let songID = song.id | 0;
    postData["music.musichallSong.PlayLyricInfo.GetPlayLyricInfo"]["param"] = {
      albumName: btoa(song.album),
      crypt: 1,
      ct: 19,
      cv: 1873,
      interval: meta.duration | 0,
      lrc_t: 0,
      qrc: 1,
      qrc_t: 0,
      roma: 1,
      roma_t: 0,
      singerName: btoa(song.album),
      songID: songID,
      songName: btoa(song.artist),
      trans: 1,
      trans_t: 0,
      type: -1,
    };

    let url = "https://u.y.qq.com/cgi-bin/musicu.fcg?";
    let params = {
      pcachetime: new Date().getTime() | 0,
    };
    url += querystring.stringify(params);
    let postDataString = JSON.stringify(postData);
    let settings = {
      method: "post",
      url: url,
      headers: headers,
      body: postDataString,
    };

    request(settings, (err, res, body) => {
      if (err || res.statusCode != 200) {
        return;
      }

      try {
        let obj = JSON.parse(body);
        if (obj["code"] != 0) {
          return;
        }

        let lyricObjRoot =
          obj["music.musichallSong.PlayLyricInfo.GetPlayLyricInfo"];
        if (lyricObjRoot["code"] != 0) {
          return;
        }

        let lyricObj = lyricObjRoot["data"];
        if (lyricObj["songID"] != songID) {
          return;
        }

        var lyricMeta = man.createLyric();
        let lyricData = restoreQrc(lyricObj["lyric"]);
        if (lyricData == null) {
          return;
        }

        lyricMeta.title = song.title;
        lyricMeta.artist = song.artist;
        lyricMeta.album = song.album;
        lyricMeta.fileType = "qrc";
        lyricMeta.lyricData = lyricData;
        man.addLyric(lyricMeta);
        ++lyricCount;
      } catch (e) {
        console.log("[qqmusic]request lyric exception: " + e.message);
      }
    });
  }

  return lyricCount;
}

function queryLyricV2(meta, man, songList) {
  let headers = {};
  headers["Referer"] = "https://y.qq.com";

  for (const song of songList) {
    let url = "https://c.y.qq.com/qqmusic/fcgi-bin/lyric_download.fcg?";
    let data = {
      version: "15",
      miniversion: "82",
      lrctype: "4",
      musicid: song.id,
    };
    url += querystring.stringify(data);

    let settings = {
      method: "get",
      url: url,
      headers: headers,
    };

    request(settings, (err, res, body) => {
      if (err || res.statusCode != 200) {
        return;
      }

      body = body
        .replace("<!--", "")
        .replace("-->", "")
        .replace(/<miniversion.*\/>/, "")
        .trim();
      let xmlRoot = mxml.loadString(body);
      if (xmlRoot != null) {
        let lyricMeta = man.createLyric();
        let lyrics = xmlRoot.findElement("lyric") || [];
        for (const lyricEntry of lyrics) {
          let content = getChildElementCDATA(lyricEntry, "content");
          if (content == null) continue;
          let lyricData = restoreQrc(content);
          if (lyricData == null) continue;
          lyricMeta.title = song.title;
          lyricMeta.artist = song.artist;
          lyricMeta.album = song.album;
          lyricMeta.lyricData = lyricData;
          lyricMeta.fileType = "qrc";
          man.addLyric(lyricMeta);
        }
      }
    });
  }
}

function queryLyric(meta, man) {
  let headers = {};
  headers["Referer"] = "https://y.qq.com";

  // qury LRC lyrics
  let queryNum = 10;
  let url = "http://c.y.qq.com/soso/fcgi-bin/client_search_cp?";
  let data = {
    format: "json",
    n: queryNum,
    p: 0,
    w: meta.title + "+" + meta.artist,
    cr: 1,
    g_tk: 5381,
  };
  url += querystring.stringify(data);

  var settings = {
    method: "get",
    url: url,
    headers: headers,
  };

  let stageSongList = [];
  request(settings, (err, res, body) => {
    console.log(err + url);
    if (!err && res.statusCode === 200) {
      try {
        var obj = JSON.parse(body);
        var data = obj["data"] || {};
        var song = data["song"] || {};
        var song_list = song["list"] || {};
        for (const song_entry of song_list) {
          var title = song_entry["songname"] || "";
          var album = song_entry["albumname"] || "";
          var artist = "";
          var artist_list = song_entry["singer"] || [];
          if (artist_list.length > 0) {
            artist = artist_list[0]["name"] || "";
          }
          var songmid = song_entry["songmid"] || "";
          if (songmid === "") {
            continue;
          }
          stageSongList.push({
            title: title,
            album: album,
            artist: artist,
            songmid: songmid,
          });
        }
      } catch (e) {
        console.log("qqmusic exception: " + e.message);
      }
    }
  });

  var lyricMeta = man.createLyric();
  for (const result of stageSongList) {
    url = "http://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?";
    data = {
      songmid: result.songmid,
      pcachetime: new Date().getTime(),
      g_tk: 5381,
      loginUin: 0,
      hostUin: 0,
      inCharset: "utf8",
      outCharset: "utf-8",
      notice: 0,
      platform: "yqq",
      needNewCode: 1,
      format: "json",
    };
    url += querystring.stringify(data);
    settings = {
      method: "get",
      url: url,
      headers: headers,
    };

    request(settings, (err, res, body) => {
      if (!err && res.statusCode === 200) {
        lyricMeta.title = result.title;
        lyricMeta.artist = result.artist;
        lyricMeta.album = result.album;
        try {
          var obj = JSON.parse(body);
          var b64lyric = obj["lyric"] || "";
          var b64tlyric = data["trans"] || "";
          var lyric = atob(b64lyric);
          var tlyric = atob(b64tlyric);
          if (tlyric != "") lyric += tlyric;
          lyricMeta.lyricText = lyric;
          man.addLyric(lyricMeta);
        } catch (e) {
          console.log("qqmusic parse lyric response exception: " + e.message);
        }
      }
    });
  }
}

function getChildElementCDATA(node, name) {
  var child = node.findElement(name);
  if (child == null) {
    return "";
  }
  var schild = child.getFirstChild();
  if (schild == null) {
    return "";
  }
  return schild.getCDATA() || "";
}

function restoreQrc(hexText) {
  if (hexText.length % 2 != 0) return null;

  const sig = "[offset:0]\n";
  var arrBuf = new Uint8Array(hexText.length / 2 + sig.length);
  for (var i = 0; i < sig.length; ++i) {
    arrBuf[i] = sig.charCodeAt(i);
  }

  const offset = sig.length;
  for (var i = 0; i < hexText.length; i += 2) {
    arrBuf[offset + i / 2] = parseInt(hexText.slice(i, i + 2), 16);
  }

  return arrBuf.buffer;
}
