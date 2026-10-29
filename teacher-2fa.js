// ================== التحقق بخطوتين (حساب المدرس) ==================
// بيضيف ui.twoFactorPanel(): لوحة بتفعّل/توقّف التحقق بخطوتين وتطلّع أكواد احتياطية.
(function () {
    "use strict";
    var ui = window.TeacherUI;
    if (!ui) return;
    var E = ui.E, h = E.h;

    function qrCanvas(text) {
        if (!window.msQR) return null;
        var q = window.msQR(text), cell = 6, quiet = 4, n = q.size + quiet * 2;
        var c = document.createElement("canvas");
        c.width = c.height = n * cell;
        c.className = "tf_qr"; c.setAttribute("role", "img"); c.setAttribute("aria-label", "QR للتطبيق");
        var g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = "#0b1033";
        for (var r = 0; r < q.size; r++) for (var k = 0; k < q.size; k++) if (q.dark(r, k)) g.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
        return c;
    }
    function copy(text, what) {
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { E.toast("اتنسخ " + (what || "")); }, function () { E.toast("انسخه يدويًا", "bad"); });
    }
    function codesBox(codes) {
        var text = codes.join("\n");
        return h("div", { class: "ac_card tf_codes" }, [
            h("h3", { class: "ac_h2", text: "الأكواد الاحتياطية" }),
            h("p", { class: "ac_banner", text: "احفظهم دلوقتي في مكان آمن (مش على نفس الموبايل). كل كود يُستخدم مرة واحدة، ومش هيظهروا تاني. لو ضاع الموبايل هما طريقك للدخول." }),
            h("ul", { class: "ac_codes tf_list" }, codes.map(function (c) { return h("li", { text: c }); })),
            h("div", { class: "ac_row" }, [
                h("button", { type: "button", class: "ac_btn b_dark b_sm", text: "نسخ الكل", onclick: function () { copy(text, "الأكواد"); } }),
                h("button", { type: "button", class: "ac_btn b_line b_sm", text: "تنزيل كملف", onclick: function () {
                    var a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([text + "\n"], { type: "text/plain" }));
                    a.download = "backup-codes.txt"; document.body.appendChild(a); a.click(); a.remove();
                } })
            ])
        ]);
    }

    // نموذج "كلمة السر + كود" لعمليتين حسّاستين (إيقاف / أكواد جديدة)
    function confirmForm(title, btnText, btnClass, endpoint, onDone) {
        var pw = h("input", { type: "password", autocomplete: "current-password", required: true });
        var code = h("input", { type: "text", inputmode: "text", dir: "ltr", maxlength: "32", autocomplete: "one-time-code", required: true, placeholder: "كود التطبيق أو كود احتياطي" });
        var msg = h("p", { class: "ac_msg", role: "alert" });
        var go = h("button", { type: "submit", class: "ac_btn " + btnClass, text: btnText });
        var f = h("form", { class: "ac_form tf_form", novalidate: true }, [
            h("h3", { class: "ac_h2", text: title }),
            h("label", { text: "كلمة السر" }), pw, h("label", { text: "كود التحقق" }), code, msg, go
        ]);
        f.addEventListener("submit", async function (ev) {
            ev.preventDefault(); msg.textContent = "";
            if (!pw.value || !code.value.trim()) { msg.textContent = "اكتب كلمة السر والكود."; return; }
            go.disabled = true;
            try { onDone(await E.call("POST", endpoint, { password: pw.value, code: code.value.trim() })); }
            catch (e) { msg.textContent = e.message || "حصل خطأ"; go.disabled = false; }
        });
        return f;
    }

    ui.twoFactorPanel = function () {
        var box = h("div", { class: "ac_card tf_panel" });
        async function show() {
            E.clear(box);
            box.appendChild(h("h2", { class: "ac_h2", text: "التحقق بخطوتين" }));
            var st;
            try { st = await E.call("GET", "/api/auth/2fa/status"); }
            catch (e) { box.appendChild(h("p", { class: "ac_msg", text: e.message })); return; }
            if (st.enabled) enabledView(st); else offView();
        }
        function offView() {
            box.appendChild(h("p", { class: "ac_sub", text: "غير مفعّل. لو فعّلته، حتى لو حد عرف كلمة السر مش هيعرف يدخل من غير كود من موبايلك." }));
            box.appendChild(h("button", { type: "button", class: "ac_btn b_dark", text: "تفعيل التحقق بخطوتين", onclick: setup }));
        }
        async function setup() {
            var d;
            try { d = await E.call("POST", "/api/auth/2fa/setup", {}); } catch (e) { E.toast(e.message, "bad"); return; }
            E.clear(box);
            box.appendChild(h("h2", { class: "ac_h2", text: "تفعيل التحقق بخطوتين" }));
            var code = h("input", { type: "text", inputmode: "numeric", dir: "ltr", maxlength: "7", autocomplete: "one-time-code", placeholder: "000000", required: true });
            var msg = h("p", { class: "ac_msg", role: "alert" });
            var qr = qrCanvas(d.otpauthUri);
            box.appendChild(h("ol", { class: "tf_steps" }, [
                h("li", { text: "نزّل تطبيق Authenticator على موبايلك (Google Authenticator أو Microsoft Authenticator أو Authy)." }),
                h("li", { text: "من التطبيق اختار «إضافة حساب» وامسح الـ QR، أو اكتب المفتاح يدويًا." }),
                h("li", { text: "اكتب الكود اللي ظهر في التطبيق هنا وأكّد." })
            ]));
            box.appendChild(h("div", { class: "tf_setup" }, [
                qr,
                h("div", null, [
                    h("p", { class: "ac_sub", text: "المفتاح (لو مش قادر تمسح الـ QR):" }),
                    h("div", { class: "ac_secret" }, [h("code", { text: d.secret.replace(/(.{4})/g, "$1 ").trim() })]),
                    h("div", { class: "ac_row" }, [
                        h("button", { type: "button", class: "ac_btn b_line b_sm", text: "نسخ المفتاح", onclick: function () { copy(d.secret, "المفتاح"); } }),
                        h("a", { class: "ac_btn b_line b_sm", href: d.otpauthUri, text: "فتح في التطبيق (على الموبايل)" })
                    ])
                ])
            ]));
            var f = h("form", { class: "ac_form tf_form", novalidate: true }, [h("label", { text: "الكود من التطبيق" }), code, msg,
                h("div", { class: "ac_row" }, [h("button", { type: "submit", class: "ac_btn b_dark", text: "تأكيد وتفعيل" }),
                    h("button", { type: "button", class: "ac_btn b_line", text: "إلغاء", onclick: show })])]);
            f.addEventListener("submit", async function (ev) {
                ev.preventDefault(); msg.textContent = "";
                try {
                    var r = await E.call("POST", "/api/auth/2fa/enable", { code: code.value.trim() });
                    E.clear(box);
                    box.appendChild(h("h2", { class: "ac_h2", text: "التحقق بخطوتين: شغّال ✓" }));
                    box.appendChild(codesBox(r.backupCodes));
                    box.appendChild(h("button", { type: "button", class: "ac_btn b_dark", text: "حفظت الأكواد", onclick: show }));
                    E.toast("اتفعّل التحقق بخطوتين");
                } catch (e) { msg.textContent = e.message || "حصل خطأ"; }
            });
            box.appendChild(f);
        }
        function enabledView(st) {
            box.appendChild(h("p", { class: "ac_sub" }, [h("span", { class: "ac_pill p_ok", text: "شغّال" }), " باقي لك " + E.num(st.backupCodesLeft) + " كود احتياطي."]));
            if (st.backupCodesLeft <= 3) box.appendChild(h("p", { class: "ac_banner", text: "الأكواد الاحتياطية قربت تخلص. اعمل أكواد جديدة." }));
            var slot = h("div");
            box.appendChild(h("div", { class: "ac_row" }, [
                h("button", { type: "button", class: "ac_btn b_line", text: "أكواد احتياطية جديدة", onclick: function () {
                    E.clear(slot);
                    slot.appendChild(confirmForm("أكواد احتياطية جديدة (القديمة هتتلغي)", "اعمل أكواد جديدة", "b_dark", "/api/auth/2fa/backup-codes", function (r) {
                        E.clear(slot); slot.appendChild(codesBox(r.backupCodes));
                    }));
                } }),
                h("button", { type: "button", class: "ac_btn b_bad", text: "إيقاف التحقق بخطوتين", onclick: function () {
                    E.clear(slot);
                    slot.appendChild(confirmForm("إيقاف التحقق بخطوتين", "إيقاف", "b_bad", "/api/auth/2fa/disable", function () { E.toast("اتوقّف التحقق بخطوتين"); show(); }));
                } })
            ]));
            box.appendChild(slot);
        }
        show();
        return box;
    };
})();
