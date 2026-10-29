// ================== exam-import.js : استخراج الأسئلة من ملف (Word / PDF / صورة / نص) بدون أي مفتاح أو فلوس ==================
// كل حاجة بتتم جوه متصفح المدرس. مفيش ملف بيتبعت لأي خدمة خارجية، والمكتبات بتتحمّل من CDN مجانًا وقت الحاجة بس.
(function () {
    "use strict";

    var LIBS = {
        pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        pdfWorker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
        mammoth: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js",
        tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"
    };
    var loaded = {};
    function loadScript(url) {
        if (!loaded[url]) loaded[url] = new Promise(function (ok, no) {
            var s = document.createElement("script");
            s.src = url; s.onload = ok; s.onerror = function () { delete loaded[url]; no(new Error("مقدرتش أحمّل أداة القراءة. اتأكد من النت وجرّب تاني.")); };
            document.head.appendChild(s);
        });
        return loaded[url];
    }

    // ---------------- 1) قراءة الملف وتحويله لنص ----------------
    var ARABIC = /[\u0600-\u06FF]/;
    function pageLines(content) {
        var rows = [];
        content.items.forEach(function (it) {
            if (!it.str || !it.str.trim()) return;
            var y = it.transform[5], x = it.transform[4], row = null;
            for (var i = 0; i < rows.length; i++) if (Math.abs(rows[i].y - y) < 3) { row = rows[i]; break; }
            if (!row) { row = { y: y, items: [] }; rows.push(row); }
            row.items.push({ x: x, s: it.str });
        });
        rows.sort(function (a, b) { return b.y - a.y; });
        return rows.map(function (r) {
            var rtl = r.items.some(function (i) { return ARABIC.test(i.s); });
            r.items.sort(function (a, b) { return rtl ? b.x - a.x : a.x - b.x; });
            return r.items.map(function (i) { return i.s; }).join(" ");
        }).join("\n");
    }

    async function ocr(source, onStatus) {
        await loadScript(LIBS.tesseract);
        var r = await window.Tesseract.recognize(source, "ara+eng", {
            logger: function (m) { if (onStatus && m.status === "recognizing text") onStatus("بقرأ الصورة... " + Math.round((m.progress || 0) * 100) + "٪"); else if (onStatus && /loading/.test(m.status || "")) onStatus("بحمّل أداة قراءة العربي (أول مرة بس)..."); }
        });
        return r.data.text || "";
    }

    async function readPdf(file, onStatus) {
        await loadScript(LIBS.pdf);
        var lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
        var pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
        var out = [], chars = 0;
        for (var p = 1; p <= pdf.numPages; p++) {
            if (onStatus) onStatus("بقرأ صفحة " + p + " من " + pdf.numPages + "...");
            var t = pageLines(await (await pdf.getPage(p)).getTextContent());
            chars += t.replace(/\s/g, "").length; out.push(t);
        }
        if (chars >= 40 * Math.min(pdf.numPages, 3)) return out.join("\n");
        // PDF متصوّر (اسكانر): نعمل OCR على الصفحات
        if (pdf.numPages > 12) throw new Error("الـ PDF ده متصوّر وكبير (" + pdf.numPages + " صفحة). قسّمه لملفات أصغر من 12 صفحة.");
        var texts = [];
        for (var q = 1; q <= pdf.numPages; q++) {
            var page = await pdf.getPage(q), vp = page.getViewport({ scale: 2 });
            var cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
            await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
            texts.push(await ocr(cv, function (m) { if (onStatus) onStatus("صفحة " + q + " من " + pdf.numPages + ": " + m); }));
        }
        return texts.join("\n");
    }

    async function readFile(file, onStatus) {
        var name = file.name || "";
        if (/\.docx$/i.test(name)) {
            if (onStatus) onStatus("بقرأ ملف الوورد...");
            await loadScript(LIBS.mammoth);
            return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
        }
        if (/\.pdf$/i.test(name) || file.type === "application/pdf") return readPdf(file, onStatus);
        if (/^image\//.test(file.type) || /\.(png|jpe?g|webp)$/i.test(name)) return ocr(file, onStatus);
        if (/\.txt$/i.test(name) || file.type === "text/plain") return file.text();
        throw new Error("نوع الملف مش مدعوم. استخدم Word (docx) أو PDF أو صورة أو ملف نصي.");
    }

    // ---------------- 2) تحويل النص لأسئلة ----------------
    var LET = ["أ", "ب", "ج", "د", "هـ"];
    function letterIndex(ch) {
        ch = ch.toLowerCase();
        if (/^[أإآا]$/.test(ch) || ch === "a") return 0;
        if (ch === "ب" || ch === "b") return 1;
        if (ch === "ج" || ch === "c") return 2;
        if (ch === "د" || ch === "d") return 3;
        if (ch === "هـ" || ch === "ه" || ch === "e") return 4;
        return -1;
    }
    function normalize(text) {
        return String(text).normalize("NFKC").replace(/\r/g, "").replace(/[\u00a0\u200e\u200f\u202a-\u202e]/g, " ")
            .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); })
            .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); });
    }
    var MARK = /[*✓✔✅☑√]/;
    var KEY_HEAD = /^\s*(?:#\s*)?(?:مفتاح\s*)?(?:ال)?إجابات(?:\s+(?:ال)?(?:صحيحة|نموذجية))?\s*[:：]?\s*$|^\s*(?:نموذج\s+(?:ال)?إجابة|answer\s*key|answers)\s*[:：]?\s*$/i;
    var Q_START = /^\s*(?:(?:س|سؤال|Q)\s*)?(\d{1,3})\s*[\)\-\.\:ـ–—]\s*(.*)$/;
    var SECTION = /^\s*(?:#+\s*)?((?:الجزء|القسم|الوحدة|الباب|Part|Section|Unit)\b.*)$/i;
    var WHY = /(?:^|\s)(?:ال)?(?:شرح|تفسير|توضيح)\s*[:：]\s*/;
    var ANS = /(?:^|\s)(?:ال)?إجابة(?:\s+(?:ال)?صحيحة)?\s*[:：]\s*[\(\[]?\s*(هـ|[أإآابجدهa-eA-E])\s*[\)\]]?/;

    // بيلاقي علامات الاختيارات (أ ب ج د) بالترتيب بس، عشان حرف عادي جوه الجملة ما يتحسبش اختيار
    function splitOptions(block) {
        var re = /(?:^|\s)[\(\[]?(هـ|[أإآابجدهa-eA-E])\s*[\)\]\-\.\:]\s*/g, m, cands = [];
        while ((m = re.exec(block))) {
            var idx = letterIndex(m[1]);
            if (idx >= 0) cands.push({ idx: idx, start: m.index, end: m.index + m[0].length });
        }
        var chain = [], want = 0;
        for (var i = 0; i < cands.length; i++) {
            if (cands[i].idx === want) { chain.push(cands[i]); want++; if (want > 4) break; }
            else if (cands[i].idx === 0 && want < 2) { chain = [cands[i]]; want = 1; } // بدأنا غلط: نعيد من أول "أ" تانية
        }
        if (chain.length < 2) return null;
        var stem = block.slice(0, chain[0].start);
        var opts = chain.map(function (c, k) { return block.slice(c.end, k + 1 < chain.length ? chain[k + 1].start : block.length); });
        return { stem: stem, options: opts };
    }

    function parseText(raw) {
        var lines = normalize(raw).split("\n").map(function (l) { return l.replace(/[ \t]+/g, " ").trim(); });
        var keyAt = -1;
        for (var k = 0; k < lines.length; k++) if (KEY_HEAD.test(lines[k])) { keyAt = k; break; }
        var keyText = keyAt >= 0 ? lines.slice(keyAt + 1).join(" ") : "";
        if (keyAt >= 0) lines = lines.slice(0, keyAt);

        // نقسّم لأسئلة: كل سؤال بيبدأ برقم
        var blocks = [], section = "", cur = null;
        lines.forEach(function (line) {
            if (!line) return;
            var sec = line.match(SECTION);
            if (sec && !Q_START.test(line) && line.length < 90) { cur = null; section = sec[1].trim(); return; }
            if (line.charAt(0) === "#") { cur = null; section = line.replace(/^#+\s*/, "").trim(); return; }
            var m = line.match(Q_START);
            if (m) {
                cur = { no: Number(m[1]), section: section, text: m[2] }; blocks.push(cur); return;
            }
            if (cur) cur.text += "\n" + line;
        });

        var key = {};
        keyText.replace(/(\d{1,3})\s*[\)\-\.\:ـ–—=]*\s*[\(\[]?\s*(هـ|[أإآابجدهa-eA-E])\s*[\)\]]?/g, function (_, n, l) { var i = letterIndex(l); if (i >= 0) key[Number(n)] = i; return _; });

        var out = [], skipped = 0, guessedNone = 0;
        blocks.forEach(function (b) {
            var body = b.text, why = "", ansLetter = -1;
            var w = body.match(WHY);
            if (w) { why = body.slice(w.index + w[0].length).replace(/\s*\n\s*/g, " ").trim(); body = body.slice(0, w.index); }
            var a = body.match(ANS);
            if (a) { ansLetter = letterIndex(a[1]); body = body.slice(0, a.index); }
            var sp = splitOptions(body);
            if (!sp) { skipped++; return; }
            var answer = -1;
            var options = sp.options.map(function (o, i) {
                var t = o.replace(/\s*\n\s*/g, " ").trim();
                if (MARK.test(t.charAt(0)) || MARK.test(t.charAt(t.length - 1))) { answer = i; }
                return t.replace(/^[*✓✔✅☑√]\s*|\s*[*✓✔✅☑√]$/g, "").trim();
            });
            if (options.some(function (o) { return !o; })) { skipped++; return; }
            if (answer < 0 && ansLetter >= 0 && ansLetter < options.length) answer = ansLetter;
            if (answer < 0 && key[b.no] !== undefined && key[b.no] < options.length) answer = key[b.no];
            if (answer < 0) guessedNone++;
            out.push({ section: b.section, q: sp.stem.replace(/\s*\n\s*/g, " ").trim(), options: options, answer: answer, why: why });
        });
        var good = out.filter(function (q) { return q.q; });
        skipped += out.length - good.length;
        return { questions: good, skipped: skipped, noAnswer: good.filter(function (q) { return q.answer < 0; }).length, usedKey: keyAt >= 0 };
    }

    window.ExamImport = { readFile: readFile, parseText: parseText, LETTERS: LET };
})();
