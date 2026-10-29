(function () {
    "use strict";
    var E = window.Eladham;
    var form = document.getElementById("ac_login");
    var err = document.getElementById("ac_err");
    var go = document.getElementById("ac_go");

    // الصفحة اللي نرجع ليها بعد الدخول: اسم ملف html في نفس الموقع بس (مفيش روابط خارجية)
    function nextPage(u) {
        var n = new URLSearchParams(location.search).get("next") || "";
        if (u.role === "student" && /^[A-Za-z0-9_-]+\.html(\?[A-Za-z0-9_=&%.-]*)?$/.test(n)) return n;
        return u.role === "teacher" ? "teacher.html" : "dashboard.html";
    }
    // لو أنت داخل بالفعل، ودّيني على لوحتي
    E.loadSession().then(function (u) { location.replace(nextPage(u)); }).catch(function () {});

    var challenge = null;
    var form2 = document.getElementById("ac_2fa"), err2 = document.getElementById("ac_err2"), go2 = document.getElementById("ac_go2"), codeIn = document.getElementById("ac_code");
    function showStep2() {
        form.classList.add("ac_hidden"); form2.classList.remove("ac_hidden");
        document.getElementById("ac_pass").value = "";
        go.disabled = false; err2.textContent = ""; codeIn.value = ""; codeIn.focus();
    }
    function backToStep1() {
        challenge = null; form2.classList.add("ac_hidden"); form.classList.remove("ac_hidden"); err.textContent = "";
    }
    document.getElementById("ac_back").addEventListener("click", backToStep1);
    form2.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        err2.textContent = "";
        var code = codeIn.value.trim();
        if (!code) { err2.textContent = "اكتب كود التحقق."; return; }
        go2.disabled = true;
        try {
            var u = await E.login2fa(challenge, code);
            location.replace(nextPage(u));
        } catch (e) {
            err2.textContent = e.message || "حصل خطأ، جرّب تاني.";
            go2.disabled = false;
            // المحاولات خلصت أو المهلة انتهت: نرجّعه لأول خطوة
            if (e.code === "CHALLENGE_EXPIRED") { backToStep1(); err.textContent = e.message; }
        }
    });

    form.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        err.textContent = "";
        var email = document.getElementById("ac_email").value.trim();
        var pass = document.getElementById("ac_pass").value;
        if (!email || !pass) { err.textContent = "اكتب رقم تليفونك (أو الإيميل) وكلمة السر."; return; }
        go.disabled = true;
        try {
            var u = await E.login(email, pass);
            if (u.twoFactorRequired) { challenge = u.challenge; showStep2(); return; }
            location.replace(nextPage(u));
        } catch (e) {
            err.textContent = e.message || "حصل خطأ، جرّب تاني.";
            go.disabled = false;
        }
    });
})();
